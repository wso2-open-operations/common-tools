// Copyright (c) 2025 WSO2 LLC.  (https://www.wso2. com). 
//
// WSO2 LLC.  licenses this file to you under the Apache License,
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
	"regexp"
	"strings"
	"sync"
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
		zap. String("project_id", cfg.GCPProjectID),
		zap.String("dataset_id", cfg. BigQueryDatasetID),
	)

	bqClient, err := bigquery.NewClient(ctx, cfg. GCPProjectID)
	if err != nil {
		return fmt.Errorf("failed to create BigQuery client: %w", err)
	}
	defer bqClient.Close()

	enabledDatabases := cfg.GetEnabledDatabases()
	totalTables := cfg.CountEnabledTables()

	if len(enabledDatabases) == 0 {
		logger. Warn("No enabled databases found in configuration")
		return nil
	}

	logger.Info("Starting sync pipeline",
		zap.Int("enabled_databases", len(enabledDatabases)),
		zap. Int("total_tables", totalTables),
		zap.Bool("dry_run", cfg. DryRun),
	)

	summary := &model.SyncSummary{
		TotalDatabases: len(enabledDatabases),
		TotalTables:    totalTables,
		Results:        make([]*model.SyncResult, 0, totalTables),
	}

	// Use mutex to protect concurrent access to summary counters
	var mu sync.Mutex
	resultsChan := make(chan *model.SyncResult, totalTables)

	g, gCtx := errgroup.WithContext(ctx)

	for _, dbConfig := range enabledDatabases {
		db := dbConfig

		for _, tableConfig := range db.GetEnabledTables() {
			tbl := tableConfig

			jobLogger := logger.With(
				zap.String("database", db.Name),
				zap.String("source_table", tbl.Name),
				zap. String("target_table", tbl.GetTargetTableName()),
			)

			g.Go(func() error {
				result := runTableJob(gCtx, bqClient, cfg, db, tbl, jobLogger)
				
				resultsChan <- result

				if result.Error != nil {
					mu.Lock()
					summary.FailedSyncs++
					mu. Unlock()
					return result.Error
				}

				mu. Lock()
				summary.SuccessfulSyncs++
				summary.TotalRowsSynced += result.RowsSynced
				mu.Unlock()
				return nil
			})
		}
	}

	err = g.Wait()
	close(resultsChan)

	for result := range resultsChan {
		summary.Results = append(summary.Results, result)
	}

	if err != nil {
		logger.Error("One or more sync jobs failed",
			zap.Error(err),
			zap.Int("successful", summary.SuccessfulSyncs),
			zap. Int("failed", summary.FailedSyncs),
		)
		return err
	}

	logSyncSummary(logger, summary)

	logger.Info("All sync jobs completed successfully",
		zap. Int("databases", summary.TotalDatabases),
		zap.Int("tables", summary.TotalTables),
		zap.Int64("total_rows", summary.TotalRowsSynced),
	)

	return nil
}

// runTableJob handles the ETL process for a single table, including schema inference,
// BigQuery table creation/update, data extraction, and load. 
func runTableJob(ctx context.Context, bqClient *bigquery.Client, cfg *model.Config, dbConfig *model.DatabaseConfig, tableConfig *model.TableConfig, logger *zap.Logger) *model.SyncResult {
	result := &model.SyncResult{
		DatabaseName: dbConfig. Name,
		TableName:    tableConfig.Name,
		TargetTable:  tableConfig.GetTargetTableName(),
		StartedAt:    time. Now(),
	}

	logger.Info("Starting table sync job")

	sourceQuery, err := buildSourceQuery(dbConfig, tableConfig)
	if err != nil {
		result.Error = fmt.Errorf("failed to build source query: %w", err)
		result.CompletedAt = time.Now()
		result.Duration = result.CompletedAt.Sub(result. StartedAt)
		logger.Error("Failed to build source query", zap.Error(err))
		return result
	}
	dummyQuery := sourceQuery + " LIMIT 1"

	logger.Debug("Generated queries",
		zap.String("source_query", sourceQuery),
	)

	db, err := openDatabaseConnection(dbConfig, cfg, logger)
	if err != nil {
		result.Error = fmt.Errorf("failed to open DB connection: %w", err)
		result.CompletedAt = time.Now()
		result.Duration = result.CompletedAt.Sub(result.StartedAt)
		logger. Error("Database connection failed", zap.Error(err))
		return result
	}
	defer db.Close()

	inferredSchema, err := InferSchemaFromDatabase(db, dbConfig. Type, dummyQuery, logger)
	if err != nil {
		result.Error = fmt.Errorf("failed to infer schema: %w", err)
		result.CompletedAt = time.Now()
		result.Duration = result.CompletedAt.Sub(result.StartedAt)
		logger. Error("Schema inference failed", zap.Error(err))
		return result
	}

	logger.Info("Schema inferred successfully",
		zap.Int("columns", len(inferredSchema)),
	)

	if cfg.DryRun {
		logger.Info("Dry run mode - skipping BigQuery operations")
		result.CompletedAt = time.Now()
		result. Duration = result.CompletedAt.Sub(result.StartedAt)
		return result
	}

	targetTableName := tableConfig. GetTargetTableName()
	bqTable := model.BQTable{Name: targetTableName, Schema: inferredSchema}

	if cfg.CreateTables {
		if err := createOrUpdateTable(ctx, bqClient, cfg. BigQueryDatasetID, bqTable, logger); err != nil {
			result.Error = fmt.Errorf("failed to create/update BigQuery table: %w", err)
			result.CompletedAt = time.Now()
			result. Duration = result.CompletedAt.Sub(result.StartedAt)
			logger.Error("BigQuery table creation failed", zap.Error(err))
			return result
		}
	}

	job := model.Job{
		Name:             tableConfig.Name,
		DatabaseName:     dbConfig.Name,
		DatabaseType:     dbConfig.Type,
		ConnectionString: dbConfig. ConnectionString,
		SourceTable:      tableConfig. Name,
		TargetTable:      targetTableName,
		Query:            sourceQuery,
		Columns:          tableConfig.Columns,
		PrimaryKey:       tableConfig.PrimaryKey,
		TimestampColumn:  tableConfig. TimestampColumn,
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
		logger. Error("Job execution failed", zap.Error(err))
		return result
	}

	result. RowsSynced = rowsSynced
	result.CompletedAt = time. Now()
	result.Duration = result. CompletedAt. Sub(result.StartedAt)

	logger.Info("Table sync job completed successfully",
		zap. Int64("rows_synced", rowsSynced),
		zap.Duration("duration", result.Duration),
	)

	return result
}

// buildSourceQuery constructs the SQL query for extracting data from the source table.
func buildSourceQuery(dbConfig *model.DatabaseConfig, tableConfig *model.TableConfig) (string, error) {
	// Validate identifiers to prevent SQL injection
	if err := validateSQLIdentifier(dbConfig.DatabaseName); err != nil {
		return "", fmt.Errorf("invalid database name: %w", err)
	}
	if err := validateSQLIdentifier(tableConfig.Name); err != nil {
		return "", fmt. Errorf("invalid table name: %w", err)
	}

	columns := "*"

	if len(tableConfig. Columns) > 0 {
		for _, col := range tableConfig.Columns {
			if err := validateSQLIdentifier(col); err != nil {
				return "", fmt.Errorf("invalid column name: %w", err)
			}
		}

		columns = strings.Join(tableConfig.Columns, ", ")
	}

	return fmt.Sprintf("SELECT %s FROM %s. %s",
		columns,
		dbConfig.DatabaseName,
		tableConfig.Name,
	), nil
}

var validSQLIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// validateSQLIdentifier ensures the identifier is safe to insert into a SQL query. 
func validateSQLIdentifier(id string) error {
	if !validSQLIdentifier. MatchString(id) {
		return fmt.Errorf("invalid SQL identifier: %s", id)
	}
	return nil
}

// openDatabaseConnection opens a connection to the source database with proper configuration.
func openDatabaseConnection(dbConfig *model.DatabaseConfig, cfg *model. Config, logger *zap.Logger) (*sql.DB, error) {
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
		zap. String("driver", driverName),
		zap.String("host", dbConfig.Host),
		zap.String("database", dbConfig.DatabaseName),
	)

	db, err := sql.Open(driverName, dbConfig.ConnectionString)
	if err != nil {
		return nil, fmt. Errorf("failed to open database connection: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	if cfg.ConnMaxLifetime > 0 {
		db.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt. Errorf("failed to ping database: %w", err)
	}

	logger.Debug("Database connection established successfully")
	return db, nil
}

// executeJob runs a full extract-and-load process by querying the source database, buffering results in memory,
// and uploading the extracted JSON data to BigQuery using a load job.
// Returns the number of rows synced and an error if any stage fails.
func executeJob(ctx context. Context, bqClient *bigquery.Client, cfg *model. Config, job model.Job, db *sql.DB, logger *zap.Logger) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("database connection is nil")
	}

	logger.Info("Executing source query", zap.String("job_name", job. Name))

	rows, err := db. QueryContext(ctx, job.Query)
	if err != nil {
		logger.Error("Failed to query database", zap. Error(err))
		return 0, fmt.Errorf("failed to query database: %w", err)
	}
	defer rows.Close()

	// In-Memory Buffer
	maxRowsPerBatch := job.BatchSize
	maxRowParseFailures := cfg.MaxRowParseFailures

	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)

	var batch []model.Savable
	var totalRowsExtracted int64
	var skippedRows int
	var lastParseError error
	rowNum := 0

	for rows.Next() {
		rowNum++
		rowData, err := job.ParseFunc(rows, logger)
		if err != nil {
			logger.Error("Failed to parse row", zap.Int("row_number", rowNum), zap.Error(err))
			skippedRows++
			lastParseError = err

			// Check if we've exceeded the maximum allowed parse failures
			// A negative value (-1) means unlimited failures are allowed
			if maxRowParseFailures >= 0 && skippedRows > maxRowParseFailures {
				logger.Error("Exceeded maximum row parse failures, aborting sync",
					zap. Int("max_failures_allowed", maxRowParseFailures),
					zap.Int("total_failures", skippedRows),
					zap.Int("rows_processed", rowNum),
					zap.Int64("rows_successfully_extracted", totalRowsExtracted),
					zap.Error(lastParseError),
				)
				return totalRowsExtracted, fmt. Errorf("exceeded maximum row parse failures (%d/%d), last error: %w",
					skippedRows, maxRowParseFailures, lastParseError)
			}
			continue
		}

		batch = append(batch, rowData)

		if len(batch) >= maxRowsPerBatch {
			for _, r := range batch {
				if err := encoder.Encode(r. ToSaveable()); err != nil {
					return 0, fmt. Errorf("failed to encode batch: %w", err)
				}
			}

			if err := uploadBufferToBigQuery(ctx, bqClient, cfg, job. TargetTable, &buf, cfg.TruncateOnSync && totalRowsExtracted == 0); err != nil {
				return 0, err
			}

			totalRowsExtracted += int64(len(batch))
			buf.Reset()
			batch = batch[:0]
		}
	}

	// Upload any remaining rows
	if len(batch) > 0 {
		for _, r := range batch {
			if err := encoder.Encode(r.ToSaveable()); err != nil {
				return 0, fmt.Errorf("failed to encode batch: %w", err)
			}
		}
		if err := uploadBufferToBigQuery(ctx, bqClient, cfg, job.TargetTable, &buf, cfg.TruncateOnSync && totalRowsExtracted == 0); err != nil {
			return 0, err
		}
		totalRowsExtracted += int64(len(batch))
	}

	if err := rows.Err(); err != nil {
		logger.Error("Error during row iteration", zap.Error(err))
		return 0, fmt.Errorf("error during row iteration: %w", err)
	}

	logger.Info("Extraction complete",
		zap.Int("total_rows_processed", rowNum),
		zap.Int64("rows_extracted", totalRowsExtracted),
		zap.Int("rows_skipped", skippedRows),
	)

	if skippedRows > 0 {
		logger. Warn("Some rows were skipped during parsing",
			zap.Int("skipped_rows", skippedRows),
			zap.Int("total_rows_processed", rowNum),
			zap.Float64("skip_percentage", float64(skippedRows)/float64(rowNum)*100),
		)
	}

	if totalRowsExtracted == 0 {
		logger.Info("No rows to load.  Job finished.")
		return 0, nil
	}
	return totalRowsExtracted, nil
}

// logSyncSummary logs a detailed summary of all sync results. 
func logSyncSummary(logger *zap.Logger, summary *model. SyncSummary) {
	logger.Info("Sync Summary",
		zap.Int("total_databases", summary. TotalDatabases),
		zap.Int("total_tables", summary.TotalTables),
		zap.Int("successful_syncs", summary.SuccessfulSyncs),
		zap.Int("failed_syncs", summary.FailedSyncs),
		zap. Int64("total_rows_synced", summary.TotalRowsSynced),
	)

	for _, result := range summary.Results {
		if result.Error != nil {
			logger. Error("Sync failed",
				zap.String("database", result.DatabaseName),
				zap. String("table", result.TableName),
				zap.Error(result.Error),
				zap.Duration("duration", result.Duration),
			)
		} else {
			logger.Info("Sync succeeded",
				zap.String("database", result. DatabaseName),
				zap.String("table", result.TableName),
				zap.String("target", result.TargetTable),
				zap.Int64("rows", result.RowsSynced),
				zap.Duration("duration", result. Duration),
			)
		}
	}
}

// uploadBufferToBigQuery uploads the JSON data stored in an in-memory buffer to a BigQuery table. 
// It creates a BigQuery load job using the provided buffer as the source.  The `truncate` flag
// controls whether the target table is overwritten (WriteTruncate) or appended to (WriteAppend).
// After the upload completes successfully, the buffer is reset for reuse.
// Returns an error if the load job creation, execution, or completion fails.
func uploadBufferToBigQuery(ctx context. Context, bqClient *bigquery.Client, cfg *model. Config, table string, buf *bytes.Buffer, truncate bool) error {
	source := bigquery.NewReaderSource(buf)
	source. SourceFormat = bigquery.JSON

	loader := bqClient.Dataset(cfg.BigQueryDatasetID).Table(table).LoaderFrom(source)
	if truncate {
		loader. WriteDisposition = bigquery. WriteTruncate
	} else {
		loader.WriteDisposition = bigquery.WriteAppend
	}

	bqJob, err := loader. Run(ctx)
	if err != nil {
		return fmt. Errorf("failed to create BigQuery load job: %w", err)
	}

	status, err := bqJob.Wait(ctx)
	if err != nil {
		return fmt. Errorf("failed to wait for BigQuery job: %w", err)
	}

	if err := status.Err(); err != nil {
		return fmt. Errorf("BigQuery load job failed: %w", err)
	}

	buf.Reset()
	return nil
}