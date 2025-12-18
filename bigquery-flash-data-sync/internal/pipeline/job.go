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
    "regexp"
    "strings"
    "sync"
    "time"

    "cloud.google.com/go/bigquery"
    "github.com/wso2-open-operations/common-tools/bigquery-flash-data-sync/internal/model"
    "go.uber.org/zap"
    "golang.org/x/sync/errgroup"
)

// DBDriver defines the function signature for getting the SQL driver name.
type DBDriver func(dbType string) string

// dbDriverMap is a registry mapping database types to their SQL driver names.
// This allows for easy extension (e.g., mapping "mssql" to "sqlserver" driver).
var dbDriverMap = map[string]string{
    "mysql":    "mysql",
    "postgres": "postgres",
}

// getDBDriver returns the appropriate SQL driver for the given database type.
func getDBDriver(dbType string) string {
    driverName, exists := dbDriverMap[strings.ToLower(dbType)]
    if !exists {
        return "mysql" // default fallback
    }
    return driverName
}

// Start initializes the BigQuery client and orchestrates multiple concurrent ETL jobs.
// NOTE: We intentionally do NOT cancel all jobs on first failure, to avoid "context canceled"
// hiding the real errors from other tables.
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
        Results:        make([]*model.SyncResult, 0, totalTables),
    }

    // Use mutex to protect concurrent access to summary counters
    var mu sync.Mutex
    resultsChan := make(chan *model.SyncResult, totalTables)

    var g errgroup.Group

    for _, dbConfig := range enabledDatabases {
        db := dbConfig

        for _, tableConfig := range db.GetEnabledTables() {
            tbl := tableConfig

            rawTarget := tbl.GetTargetTableName()
            safeTarget, terr := bigQueryTableID(rawTarget)
            if terr != nil {
                // Keep raw for logging if it's invalid; runTableJob will fail with a clear error.
                safeTarget = rawTarget
            }

            jobLogger := logger.With(
                zap.String("database", db.Name),
                zap.String("source_table", tbl.Name),
                zap.String("target_table", safeTarget),
            )

            g.Go(func() error {
                // Use the original ctx (no group-cancel context) so one failing table
                // doesn't cancel all other in-flight table jobs.
                result := runTableJob(ctx, bqClient, cfg, db, tbl, jobLogger)

                resultsChan <- result

                if result.Error != nil {
                    mu.Lock()
                    summary.FailedSyncs++
                    mu.Unlock()
                    return fmt.Errorf("failed sync at %s.%s: %w", db.Name, tbl.Name, result.Error)
                }

                mu.Lock()
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
    rawTarget := tableConfig.GetTargetTableName()
    targetTableName, err := bigQueryTableID(rawTarget)
    if err != nil {
        return &model.SyncResult{
            DatabaseName: dbConfig.Name,
            TableName:    tableConfig.Name,
            TargetTable:  rawTarget,
            StartedAt:    time.Now(),
            CompletedAt:  time.Now(),
            Duration:     0,
            Error:        fmt.Errorf("invalid BigQuery target table name %q: %w", rawTarget, err),
        }
    }

    result := &model.SyncResult{
        DatabaseName: dbConfig.Name,
        TableName:    tableConfig.Name,
        TargetTable:  targetTableName,
        StartedAt:    time.Now(),
    }

    logger.Info("Starting table sync job")

    sourceQuery, err := buildSourceQuery(dbConfig, tableConfig)
    if err != nil {
        result.Error = fmt.Errorf("failed to build source query: %w", err)
        result.CompletedAt = time.Now()
        result.Duration = result.CompletedAt.Sub(result.StartedAt)
        logger.Error("Failed to build source query", zap.Error(err))
        return result
    }
    dummyQuery := sourceQuery + " LIMIT 1"

    logger.Debug("Generated queries",
        zap.String("source_query", sourceQuery),
    )

    db, err := openDatabaseConnection(ctx, dbConfig, cfg, logger)
    if err != nil {
        result.Error = fmt.Errorf("failed to open DB connection: %w", err)
        result.CompletedAt = time.Now()
        result.Duration = result.CompletedAt.Sub(result.StartedAt)
        logger.Error("Database connection failed", zap.Error(err))
        return result
    }
    defer db.Close()

    inferredSchema, err := InferSchemaFromDatabase(db, dbConfig.Type, dbConfig.Name, dummyQuery, logger)
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
//
// Design note:
//   - For MySQL, DatabaseName represents the database and queries are generated as: database.table
//   - For PostgreSQL, DatabaseName represents the schema and queries are generated as: schema.table
//
// This implementation also supports fully-qualified table names passed via config (e.g., "schema.table").
//
// PostgreSQL connections are always made to a single database via the connection string.
// Schema selection is handled explicitly at the query level.
func buildSourceQuery(dbConfig *model.DatabaseConfig, tableConfig *model.TableConfig) (string, error) {
    // Columns: validate as single-part identifiers.
    columns := "*"
    if len(tableConfig.Columns) > 0 {
        for _, col := range tableConfig.Columns {
            if err := validateSQLIdentifier(col); err != nil {
                return "", fmt.Errorf("invalid column name: %w", err)
            }
        }
        columns = strings.Join(tableConfig.Columns, ", ")
    }

    dbType := strings.ToLower(dbConfig.Type)

    // Tables may come as "table" or "schema.table" (or "database.table" for MySQL).
    schemaOrDB, table, hasQualifier, err := splitQualifiedName(tableConfig.Name)
    if err != nil {
        return "", fmt.Errorf("invalid table name: %w", err)
    }

    switch dbType {
    case "postgres":
        // Prefer schema provided in the table name (schema.table). Fallback to DatabaseName as schema.
        schema := schemaOrDB
        if !hasQualifier {
            if dbConfig.DatabaseName == "" {
                return "", fmt.Errorf("schema not provided: use TABLES=schema.table or set DatabaseName as schema for PostgreSQL")
            }
            if err := validateSQLIdentifier(dbConfig.DatabaseName); err != nil {
                return "", fmt.Errorf("invalid schema name: %w", err)
            }
            schema = dbConfig.DatabaseName
        }

        return fmt.Sprintf(
            "SELECT %s FROM %s.%s",
            columns,
            schema,
            table,
        ), nil

    default:
        // MySQL and others: Prefer database provided in the table name (db.table). Fallback to DatabaseName.
        dbName := schemaOrDB
        if !hasQualifier {
            if err := validateSQLIdentifier(dbConfig.DatabaseName); err != nil {
                return "", fmt.Errorf("invalid database name: %w", err)
            }
            dbName = dbConfig.DatabaseName
        }

        return fmt.Sprintf(
            "SELECT %s FROM %s.%s",
            columns,
            dbName,
            table,
        ), nil
    }
}

var validSQLIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// validateSQLIdentifier ensures the identifier is safe to insert into a SQL query.
func validateSQLIdentifier(id string) error {
    if !validSQLIdentifier.MatchString(id) {
        return fmt.Errorf("invalid SQL identifier: %s", id)
    }
    return nil
}

// splitQualifiedName splits a potentially qualified name ("a.b") into parts.
// Returns (qualifier, name, hasQualifier).
func splitQualifiedName(name string) (string, string, bool, error) {
    name = strings.TrimSpace(name)
    if name == "" {
        return "", "", false, fmt.Errorf("empty identifier")
    }

    parts := strings.Split(name, ".")
    switch len(parts) {
    case 1:
        p := strings.TrimSpace(parts[0])
        if err := validateSQLIdentifier(p); err != nil {
            return "", "", false, err
        }
        return "", p, false, nil
    case 2:
        p0 := strings.TrimSpace(parts[0])
        p1 := strings.TrimSpace(parts[1])
        if err := validateSQLIdentifier(p0); err != nil {
            return "", "", false, err
        }
        if err := validateSQLIdentifier(p1); err != nil {
            return "", "", false, err
        }
        return p0, p1, true, nil
    default:
        return "", "", false, fmt.Errorf("expected identifier in form name or a.b: %s", name)
    }
}

// bigQueryTableID ensures a table name is a valid BigQuery table ID.
// If the name is qualified (e.g., "schema.table"), it is mapped to "schema__table".
func bigQueryTableID(name string) (string, error) {
    name = strings.TrimSpace(name)
    if name == "" {
        return "", fmt.Errorf("empty table name")
    }

    // If already a simple identifier, accept.
    if validSQLIdentifier.MatchString(name) {
        return name, nil
    }

    // If qualified, map to schema__table.
    q, t, hasQ, err := splitQualifiedName(name)
    if err != nil {
        return "", err
    }
    if !hasQ {
        // splitQualifiedName would have returned earlier; keep for safety.
        return "", fmt.Errorf("invalid BigQuery table id: %s", name)
    }

    mapped := q + "__" + t
    if !validSQLIdentifier.MatchString(mapped) {
        return "", fmt.Errorf("invalid BigQuery table id after mapping: %s", mapped)
    }
    return mapped, nil
}

// openDatabaseConnection opens a connection to the source database with proper configuration.
// It uses the map-based driver lookup for type safety and extensibility.
func openDatabaseConnection(ctx context.Context, dbConfig *model.DatabaseConfig, cfg *model.Config, logger *zap.Logger) (*sql.DB, error) {
    // Map lookup based on database type (case-insensitive)
    driverName := getDBDriver(dbConfig.Type)

    logger.Debug("Opening database connection",
        zap.String("driver", driverName),
        zap.String("host", dbConfig.Host),
        zap.String("database", dbConfig.DatabaseName),
        zap.String("database_type", dbConfig.Type),
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

    // Apply timeout to ping operation
    pingCtx := ctx
    if cfg.SyncTimeout > 0 {
        var cancel context.CancelFunc
        pingCtx, cancel = context.WithTimeout(ctx, cfg.SyncTimeout)
        defer cancel()
    }

    if err := db.PingContext(pingCtx); err != nil {
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

            // A negative value (-1) means unlimited failures are allowed
            if maxRowParseFailures >= 0 && skippedRows > maxRowParseFailures {
                logger.Error("Exceeded maximum row parse failures, aborting sync",
                    zap.Int("max_failures_allowed", maxRowParseFailures),
                    zap.Int("total_failures", skippedRows),
                    zap.Int("rows_processed", rowNum),
                    zap.Int64("rows_successfully_extracted", totalRowsExtracted),
                    zap.Error(lastParseError),
                )
                return totalRowsExtracted, fmt.Errorf("exceeded maximum row parse failures (%d/%d), last error: %w",
                    skippedRows, maxRowParseFailures, lastParseError)
            }
            continue
        }

        batch = append(batch, rowData)

        if len(batch) >= maxRowsPerBatch {
            for _, r := range batch {
                if err := encoder.Encode(r.ToSaveable()); err != nil {
                    return 0, fmt.Errorf("failed to encode batch: %w", err)
                }
            }

            if err := uploadBufferToBigQuery(ctx, bqClient, cfg, job.TargetTable, &buf, cfg.TruncateOnSync && totalRowsExtracted == 0); err != nil {
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
        logger.Warn("Some rows were skipped during parsing",
            zap.Int("skipped_rows", skippedRows),
            zap.Int("total_rows_processed", rowNum),
            zap.Float64("skip_percentage", float64(skippedRows)/float64(rowNum)*100),
        )
    }

    if totalRowsExtracted == 0 {
        logger.Info("No rows to load. Job finished.")
        return 0, nil
    }
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
            logger.Debug("Sync succeeded",
                zap.String("database", result.DatabaseName),
                zap.String("table", result.TableName),
                zap.String("target", result.TargetTable),
                zap.Int64("rows", result.RowsSynced),
                zap.Duration("duration", result.Duration),
            )
        }
    }
}

func formatBigQueryStatusErrors(status *bigquery.JobStatus) string {
    if status == nil || len(status.Errors) == 0 {
        return ""
    }
    var b strings.Builder
    b.WriteString(" BigQuery errors:")
    for i, e := range status.Errors {
        // Keep it compact; BigQuery often provides location/reason/message.
        b.WriteString(fmt.Sprintf(" [%d] reason=%q location=%q message=%q", i, e.Reason, e.Location, e.Message))
        if i >= 4 {
            b.WriteString(" ...")
            break
        }
    }
    return b.String()
}

// uploadBufferToBigQuery uploads the JSON data stored in an in-memory buffer to a BigQuery table.
// It creates a BigQuery load job using the provided buffer as the source. The `truncate` flag
// controls whether the target table is overwritten (WriteTruncate) or appended to (WriteAppend).
// After the upload completes successfully, the buffer is reset for reuse.
// Returns an error if the load job creation, execution, or completion fails.
func uploadBufferToBigQuery(ctx context.Context, bqClient *bigquery.Client, cfg *model.Config, table string, buf *bytes.Buffer, truncate bool) error {
    source := bigquery.NewReaderSource(buf)
    source.SourceFormat = bigquery.JSON

    loader := bqClient.Dataset(cfg.BigQueryDatasetID).Table(table).LoaderFrom(source)
    if truncate {
        loader.WriteDisposition = bigquery.WriteTruncate
    } else {
        loader.WriteDisposition = bigquery.WriteAppend
    }

    bqJob, err := loader.Run(ctx)
    if err != nil {
        return fmt.Errorf("failed to create BigQuery load job: %w", err)
    }

    status, err := bqJob.Wait(ctx)
    if err != nil {
        return fmt.Errorf("failed to wait for BigQuery job: %w", err)
    }

    if stErr := status.Err(); stErr != nil {
        return fmt.Errorf("BigQuery load job failed: %w.%s", stErr, formatBigQueryStatusErrors(status))
    }

    buf.Reset()
    return nil
}