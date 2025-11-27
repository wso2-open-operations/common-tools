// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// Package pipeline provides utilities to orchestrate ETL jobs that extract data from SQL sources,
// infer schemas, and load the data into BigQuery tables concurrently with logging and error handling.
// It supports multiple database types (MySQL, PostgreSQL) and dynamic table configuration.
package pipeline

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/wso2-open-operations/common-tools/bigquery-flash-data-sync/internal/model"
	"golang.org/x/sync/errgroup"

	"cloud.google.com/go/bigquery"
	"go.uber.org/zap"
)

// Start initializes the BigQuery client and orchestrates multiple concurrent ETL jobs using errgroup.
// It dynamically processes all enabled databases and tables from the configuration.
// Returns an error if any job fails or if client initialization encounters an issue.
func Start(ctx context.Context, cfg *model.Config, logger *zap.Logger) error {
	logger.Info("Initializing BigQuery client",
		zap.String("project_id", cfg.GCPProjectID),
		zap.String("dataset_id", cfg.BigQueryDatasetID),
	)

	bqClient, err := bigquery.NewClient(ctx, cfg.GCPProjectID)
	if err != nil {
		return fmt.Errorf("failed to create BigQuery client: %w", err)
	}
	defer bqClient.Close()

	enabledDatabases := cfg.GetEnabledDatabases()
	totalTables := cfg.CountEnabledTables()

	if len(enabledDatabases) == 0 {
		logger.Warn("No enabled databases found in configuration")
		return nil
	}

	logger.Info("Starting sync pipeline",
		zap.Int("enabled_databases", len(enabledDatabases)),
		zap.Int("total_tables", totalTables),
		zap.Bool("dry_run", cfg.DryRun),
	)

	summary := &model.SyncSummary{
		TotalDatabases: len(enabledDatabases),
		TotalTables:    totalTables,
		Results:        make([]*model.SyncResult, 0),
	}

	g, gCtx := errgroup.WithContext(ctx)

	for _, dbConfig := range enabledDatabases {
		db := dbConfig

		for _, tableConfig := range db.GetEnabledTables() {
			tbl := tableConfig

			jobLogger := logger.With(
				zap.String("database", db.Name),
				zap.String("source_table", tbl.Name),
				zap.String("target_table", tbl.GetTargetTableName()),
			)

			g.Go(func() error {
				result := runTableJob(gCtx, bqClient, cfg, db, tbl, jobLogger)
				summary.Results = append(summary.Results, result)

				if result.Error != nil {
					summary.FailedSyncs++
					return result.Error
				}

				summary.SuccessfulSyncs++
				summary.TotalRowsSynced += result.RowsSynced
				return nil
			})
		}
	}

	if err := g.Wait(); err != nil {
		logger.Error("One or more sync jobs failed",
			zap.Error(err),
			zap.Int("successful", summary.SuccessfulSyncs),
			zap.Int("failed", summary.FailedSyncs),
		)
		return err
	}

	logSyncSummary(logger, summary)

	logger.Info("All sync jobs completed successfully",
		zap.Int("databases", summary.TotalDatabases),
		zap.Int("tables", summary.TotalTables),
		zap.Int64("total_rows", summary.TotalRowsSynced),
	)

	return nil
}

// runTableJob handles the ETL process for a single table, including schema inference,
// BigQuery table creation/update, data extraction, and load.
func runTableJob(ctx context.Context, bqClient *bigquery.Client, cfg *model.Config, dbConfig *model.DatabaseConfig, tableConfig *model.TableConfig, logger *zap.Logger) *model.SyncResult {
	result := &model.SyncResult{
		DatabaseName: dbConfig.Name,
		TableName:    tableConfig.Name,
		TargetTable:  tableConfig.GetTargetTableName(),
		StartedAt:    time.Now(),
	}

	logger.Info("Starting table sync job")

	sourceQuery := buildSourceQuery(dbConfig, tableConfig)
	dummyQuery := sourceQuery + " LIMIT 1"

	logger.Debug("Generated queries",
		zap.String("source_query", sourceQuery),
	)

	db, err := openDatabaseConnection(dbConfig, cfg, logger)
	if err != nil {
		result.Error = fmt.Errorf("failed to open DB connection: %w", err)
		result.CompletedAt = time.Now()
		result.Duration = result.CompletedAt.Sub(result.StartedAt)
		logger.Error("Database connection failed", zap.Error(err))
		return result
	}
	defer db.Close()

	inferredSchema, err := InferSchemaFromDatabase(db, dbConfig.Type, dummyQuery, logger)
	if err != nil {
		result.Error = fmt.Errorf("failed to infer schema: %w", err)
		result.CompletedAt = time.Now()
		result.Duration = result.CompletedAt.Sub(result.StartedAt)
		logger.Error("Schema inference failed", zap.Error(err))
		return result
	}

	logger.Info("Schema inferred successfully",
		zap.Int("columns", len(inferredSchema)),
	)

	if cfg.DryRun {
		logger.Info("Dry run mode - skipping BigQuery operations")
		result.CompletedAt = time.Now()
		result.Duration = result.CompletedAt.Sub(result.StartedAt)
		return result
	}

	targetTableName := tableConfig.GetTargetTableName()
	bqTable := model.BQTable{Name: targetTableName, Schema: inferredSchema}

	if cfg.CreateTables {
		if err := createOrUpdateTable(ctx, bqClient, cfg.BigQueryDatasetID, bqTable, logger); err != nil {
			result.Error = fmt.Errorf("failed to create/update BigQuery table: %w", err)
			result.CompletedAt = time.Now()
			result.Duration = result.CompletedAt.Sub(result.StartedAt)
			logger.Error("BigQuery table creation failed", zap.Error(err))
			return result
		}
	}

	job := model.Job{
		Name:             tableConfig.Name,
		DatabaseName:     dbConfig.Name,
		DatabaseType:     dbConfig.Type,
		ConnectionString: dbConfig.ConnectionString,
		SourceTable:      tableConfig.Name,
		TargetTable:      targetTableName,
		Query:            sourceQuery,
		Columns:          tableConfig.Columns,
		PrimaryKey:       tableConfig.PrimaryKey,
		TimestampColumn:  tableConfig.TimestampColumn,
		BatchSize:        tableConfig.GetBatchSize(cfg.DefaultBatchSize),
		ParseFunc: func(rows *sql.Rows, logger *zap.Logger) (model.Savable, error) {
			return model.ParseDynamicRow(rows, logger, cfg.DateFormat)
		},
	}

	rowsSynced, err := executeJob(ctx, bqClient, cfg, job, db, logger)
	if err != nil {
		result.Error = fmt.Errorf("job execution failed: %w", err)
		result.CompletedAt = time.Now()
		result.Duration = result.CompletedAt.Sub(result.StartedAt)
		logger.Error("Job execution failed", zap.Error(err))
		return result
	}

	result.RowsSynced = rowsSynced
	result.CompletedAt = time.Now()
	result.Duration = result.CompletedAt.Sub(result.StartedAt)

	logger.Info("Table sync job completed successfully",
		zap.Int64("rows_synced", rowsSynced),
		zap.Duration("duration", result.Duration),
	)

	return result
}

// buildSourceQuery constructs the SQL query for extracting data from the source table.
func buildSourceQuery(dbConfig *model.DatabaseConfig, tableConfig *model.TableConfig) string {
	columns := "*"
	if len(tableConfig.Columns) > 0 {
		columns = ""
		for i, col := range tableConfig.Columns {
			if i > 0 {
				columns += ", "
			}
			columns += col
		}
	}

	return fmt.Sprintf("SELECT %s FROM %s.%s", columns, dbConfig.DatabaseName, tableConfig.Name)
}

// openDatabaseConnection opens a connection to the source database with proper configuration.
func openDatabaseConnection(dbConfig *model.DatabaseConfig, cfg *model.Config, logger *zap.Logger) (*sql.DB, error) {
	var driverName string
	switch dbConfig.Type {
	case "mysql":
		driverName = "mysql"
	case "postgres":
		driverName = "postgres"
	default:
		driverName = "mysql"
	}

	logger.Debug("Opening database connection",
		zap.String("driver", driverName),
		zap.String("host", dbConfig.Host),
		zap.String("database", dbConfig.DatabaseName),
	)

	db, err := sql.Open(driverName, dbConfig.ConnectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	if cfg.ConnMaxLifetime > 0 {
		db.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	logger.Debug("Database connection established successfully")
	return db, nil
}

// executeJob runs a full extract-and-load process by querying the source database, buffering results in memory,
// and uploading the extracted JSON data to BigQuery using a load job.
// Returns the number of rows synced and an error if any stage fails.
func executeJob(ctx context.Context, bqClient *bigquery.Client, cfg *model.Config, job model.Job, db *sql.DB, logger *zap.Logger) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("database connection is nil")
	}

	logger.Info("Executing source query", zap.String("job_name", job.Name))

	rows, err := db.QueryContext(ctx, job.Query)
	if err != nil {
		logger.Error("Failed to query database", zap.Error(err))
		return 0, fmt.Errorf("failed to query database: %w", err)
	}
	defer rows.Close()

	// In-Memory Buffer
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	logger.Debug("Starting data extraction to in-memory buffer")

	var totalRowsExtracted int64
	rowNum := 0
	skippedRows := 0

	for rows.Next() {
		rowNum++
		row, err := job.ParseFunc(rows, logger)
		if err != nil {
			logger.Error("Failed to parse row",
				zap.Int("row_number", rowNum),
				zap.Error(err),
			)
			skippedRows++
			continue
		}

		if err := encoder.Encode(row.ToSaveable()); err != nil {
			logger.Error("Failed to write row to memory buffer",
				zap.Int("row_number", rowNum),
				zap.Error(err),
			)
			return 0, fmt.Errorf("failed to write row to memory buffer: %w", err)
		}

		totalRowsExtracted++

		if totalRowsExtracted%10000 == 0 {
			logger.Debug("Extraction progress",
				zap.Int64("rows_extracted", totalRowsExtracted),
			)
		}
	}

	if err := rows.Err(); err != nil {
		logger.Error("Error during row iteration", zap.Error(err))
		return 0, fmt.Errorf("error during row iteration: %w", err)
	}

	logger.Info("Extraction complete",
		zap.Int64("rows_extracted", totalRowsExtracted),
		zap.Int("rows_skipped", skippedRows),
	)

	if skippedRows > 0 {
		logger.Warn("Some rows were skipped during parsing",
			zap.Int("skipped_rows", skippedRows),
		)
	}

	if totalRowsExtracted == 0 {
		logger.Info("No rows to load. Job finished.")
		return 0, nil
	}

	source := bigquery.NewReaderSource(&buf)
	source.SourceFormat = bigquery.JSON

	loader := bqClient.Dataset(cfg.BigQueryDatasetID).Table(job.TargetTable).LoaderFrom(source)

	if cfg.TruncateOnSync {
		loader.WriteDisposition = bigquery.WriteTruncate
	} else {
		loader.WriteDisposition = bigquery.WriteAppend
	}

	logger.Info("Starting BigQuery load job",
		zap.String("table", job.TargetTable),
		zap.Int64("rows", totalRowsExtracted),
	)

	bqJob, err := loader.Run(ctx)
	if err != nil {
		logger.Error("Failed to create BigQuery load job", zap.Error(err))
		return 0, fmt.Errorf("failed to create BigQuery load job: %w", err)
	}

	status, err := bqJob.Wait(ctx)
	if err != nil {
		logger.Error("Failed to wait for BigQuery job to complete", zap.Error(err))
		return 0, fmt.Errorf("failed to wait for BigQuery job to complete: %w", err)
	}

	if err := status.Err(); err != nil {
		logger.Error("BigQuery load job failed", zap.Error(err))
		return 0, fmt.Errorf("BigQuery load job failed: %w", err)
	}

	logger.Info("BigQuery load job completed successfully",
		zap.String("table", job.TargetTable),
		zap.Int64("rows_loaded", totalRowsExtracted),
	)

	return totalRowsExtracted, nil
}

// logSyncSummary logs a detailed summary of all sync results.
func logSyncSummary(logger *zap.Logger, summary *model.SyncSummary) {
	logger.Info("Sync Summary",
		zap.Int("total_databases", summary.TotalDatabases),
		zap.Int("total_tables", summary.TotalTables),
		zap.Int("successful_syncs", summary.SuccessfulSyncs),
		zap.Int("failed_syncs", summary.FailedSyncs),
		zap.Int64("total_rows_synced", summary.TotalRowsSynced),
	)

	for _, result := range summary.Results {
		if result.Error != nil {
			logger.Error("Sync failed",
				zap.String("database", result.DatabaseName),
				zap.String("table", result.TableName),
				zap.Error(result.Error),
				zap.Duration("duration", result.Duration),
			)
		} else {
			logger.Info("Sync succeeded",
				zap.String("database", result.DatabaseName),
				zap.String("table", result.TableName),
				zap.String("target", result.TargetTable),
				zap.Int64("rows", result.RowsSynced),
				zap.Duration("duration", result.Duration),
			)
		}
	}
}
