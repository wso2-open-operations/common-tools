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
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
// OF ANY KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License

// Package config is responsible for loading and parsing all environment variables
// needed for the application to run. It supports dynamic configuration for any
// number of databases and tables.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/wso2-open-operations/common-tools/bigquery-flash-data-sync/internal/model"
	"go.uber.org/zap"
)

const (
	DatabasesKey = "SYNC_DATABASES"

	DefaultDBHost     = "DB_HOST"
	DefaultDBPort     = "DB_PORT"
	DefaultDBType     = "DB_TYPE"
	DBMaxOpenConns    = "DB_MAX_OPEN_CONNECTIONS"
	DBMaxIdleConns    = "DB_MAX_IDLE_CONNECTIONS"
	DBConnMaxLifetime = "DB_CONN_MAX_LIFETIME"

	GCPProjectID = "GCP_PROJECT_ID"
	BQDatasetID  = "BQ_DATASET_ID"

	SyncTimeoutKey      = "SYNC_TIMEOUT"
	DateFormatKey       = "DATE_FORMAT"
	DefaultBatchSizeKey = "DEFAULT_BATCH_SIZE"

	DryRunKey              = "DRY_RUN"
	CreateTablesKey        = "AUTO_CREATE_TABLES"
	TruncateOnSyncKey      = "TRUNCATE_ON_SYNC"
	MaxRowParseFailuresKey = "MAX_ROW_PARSE_FAILURES"
)

// LoadConfig reads all required environment variables and builds database connection strings.
// It supports dynamic configuration for any number of databases and tables.
func LoadConfig(logger *zap.Logger) (*model.Config, error) {
	logger.Info("Loading configuration from environment variables")

	gcpProjectID := getEnv(GCPProjectID, "")
	bqDatasetID := getEnv(BQDatasetID, "")
	if gcpProjectID == "" || bqDatasetID == "" {
		return nil, fmt.Errorf("GCP_PROJECT_ID and BQ_DATASET_ID are required")
	}

	dbNames := getEnv(DatabasesKey, "")
	if dbNames == "" {
		return nil, fmt.Errorf("SYNC_DATABASES is required (comma-separated list of database identifiers)")
	}

	databases := make(map[string]*model.DatabaseConfig)
	for _, dbName := range parseCommaList(dbNames) {
		dbConfig, err := loadDatabaseConfig(logger, dbName)
		if err != nil {
			return nil, fmt.Errorf("failed to load config for database '%s': %w", dbName, err)
		}
		databases[dbName] = dbConfig

		logger.Info("Loaded database configuration",
			zap.String("database", dbName),
			zap.Int("tables", len(dbConfig.Tables)),
		)
	}

	if len(databases) == 0 {
		return nil, fmt.Errorf("no valid database configurations found")
	}

	maxOpen := parseInt(logger, DBMaxOpenConns, "10", 10)
	maxIdle := parseInt(logger, DBMaxIdleConns, "10", 10)
	defaultBatchSize := parseInt(logger, DefaultBatchSizeKey, "1000", 1000)
	maxRowParseFailures := parseInt(logger, MaxRowParseFailuresKey, "100", 100)

	syncTimeout := parseDuration(logger, SyncTimeoutKey, "10m", 10*time.Minute)
	connMaxLifetime := parseDuration(logger, DBConnMaxLifetime, "1m", 1*time.Minute)

	dateFormat := getEnv(DateFormatKey, "2006-01-02T15:04:05Z07:00")

	dryRun := parseBool(getEnv(DryRunKey, "false"))
	createTables := parseBool(getEnv(CreateTablesKey, "true"))
	truncateOnSync := parseBool(getEnv(TruncateOnSyncKey, "false"))

	cfg := &model.Config{
		GCPProjectID:        gcpProjectID,
		BigQueryDatasetID:   bqDatasetID,
		Databases:           databases,
		SyncTimeout:         syncTimeout,
		DateFormat:          dateFormat,
		DefaultBatchSize:    defaultBatchSize,
		MaxOpenConns:        maxOpen,
		MaxIdleConns:        maxIdle,
		ConnMaxLifetime:     connMaxLifetime,
		DryRun:              dryRun,
		CreateTables:        createTables,
		TruncateOnSync:      truncateOnSync,
		MaxRowParseFailures: maxRowParseFailures,
	}

	logger.Info("Configuration loaded successfully",
		zap.String("gcp_project", cfg.GCPProjectID),
		zap.String("bq_dataset", cfg.BigQueryDatasetID),
		zap.Int("database_count", len(databases)),
		zap.Bool("dry_run", cfg.DryRun),
		zap.Int("max_row_parse_failures", cfg.MaxRowParseFailures),
	)

	return cfg, nil
}

// loadDatabaseConfig loads configuration for a specific database.
// Environment variables are prefixed with the database identifier in uppercase.
// Example: For database "finance", use FINANCE_DB_HOST, FINANCE_DB_NAME, etc.
func loadDatabaseConfig(logger *zap.Logger, dbID string) (*model.DatabaseConfig, error) {
	prefix := strings.ToUpper(strings.TrimSpace(dbID)) + "_"

	host := getEnvWithFallback(prefix, "DB_HOST", DefaultDBHost, "localhost")
	port := getEnvWithFallback(prefix, "DB_PORT", DefaultDBPort, "3306")
	dbType := getEnvWithFallback(prefix, "DB_TYPE", DefaultDBType, "mysql")

	database := getEnv(prefix+"DB_NAME", "")
	user := getEnv(prefix+"DB_USER", "")
	password := getEnv(prefix+"DB_PASSWORD", "")
	enabled := parseBool(getEnv(prefix+"ENABLED", "true"))

	if database == "" || user == "" {
		return nil, fmt.Errorf("missing required config: %sDB_NAME and %sDB_USER are required", prefix, prefix)
	}

	connString := buildConnectionString(logger, dbType, host, port, database, user, password, prefix)

	tables, err := loadTableConfigs(logger, dbID)
	if err != nil {
		return nil, fmt.Errorf("failed to load table configs: %w", err)
	}

	return &model.DatabaseConfig{
		Name:             dbID,
		Type:             dbType,
		Host:             host,
		Port:             port,
		DatabaseName:     database,
		User:             user,
		ConnectionString: connString,
		Tables:           tables,
		Enabled:          enabled,
	}, nil
}

// loadTableConfigs loads table configurations for a specific database.
// Tables are specified via {PREFIX}_TABLES environment variable.
func loadTableConfigs(logger *zap.Logger, dbID string) (map[string]*model.TableConfig, error) {
	prefix := strings.ToUpper(strings.TrimSpace(dbID)) + "_"
	tablesStr := getEnv(prefix+"TABLES", "")
	if tablesStr == "" {
		return nil, fmt.Errorf("%sTABLES is required (comma-separated list of table names)", prefix)
	}

	tableList := parseCommaList(tablesStr)
	if len(tableList) == 0 {
		return nil, fmt.Errorf("no valid tables found for database '%s'", dbID)
	}

	tables := make(map[string]*model.TableConfig, len(tableList))
	for _, tableName := range tableList {
		tables[tableName] = loadTableConfig(logger, dbID, tableName)
	}

	return tables, nil
}

// loadTableConfig loads configuration for a specific table.
// Environment variables are prefixed with {DB_ID}_{TABLE_NAME}_ in uppercase.
func loadTableConfig(logger *zap.Logger, dbID, tableName string) *model.TableConfig {
	prefix := strings.ToUpper(strings.TrimSpace(dbID)) + "_" + strings.ToUpper(strings.TrimSpace(tableName)) + "_"

	targetTable := getEnv(prefix+"TARGET_TABLE", tableName)
	primaryKey := getEnv(prefix+"PRIMARY_KEY", "id")
	timestampCol := getEnv(prefix+"TIMESTAMP_COLUMN", "")
	columnsStr := getEnv(prefix+"COLUMNS", "")
	batchSize := parseInt(logger, prefix+"BATCH_SIZE", "0", 0)
	enabled := parseBool(getEnv(prefix+"ENABLED", "true"))

	return &model.TableConfig{
		Name:            tableName,
		TargetTable:     targetTable,
		PrimaryKey:      primaryKey,
		TimestampColumn: timestampCol,
		Columns:         parseCommaList(columnsStr),
		BatchSize:       batchSize,
		Enabled:         enabled,
	}
}

// buildConnectionString creates a database connection string based on type.
//
// NOTE: This version uses parseInt() for timeouts, so the timeout env vars must be integers:
// - {DB}_DB_CONN_TIMEOUT        (seconds)
// - {DB}_DB_READ_TIMEOUT        (seconds)  (MySQL socket read timeout; also default for PG statement timeout)
// - {DB}_DB_WRITE_TIMEOUT       (seconds)
// - {DB}_DB_STATEMENT_TIMEOUT   (seconds)  (Postgres only; converted to milliseconds)
func buildConnectionString(logger *zap.Logger, dbType, host, port, database, user, password, prefix string) string {
	dbType = strings.ToLower(strings.TrimSpace(dbType))

	timeoutSec := func(key string, def int) int {
		return parseInt(logger, prefix+key, strconv.Itoa(def), def)
	}

	connTimeoutSec := timeoutSec("DB_CONN_TIMEOUT", 30)
	readTimeoutSec := timeoutSec("DB_READ_TIMEOUT", 60)
	writeTimeoutSec := timeoutSec("DB_WRITE_TIMEOUT", 60)

	sslMode := getEnv(prefix+"DB_SSLMODE", getEnv("DB_SSLMODE", "require"))

	// Postgres only: if not set, default to read timeout
	statementTimeoutSec := parseInt(
		logger,
		prefix+"DB_STATEMENT_TIMEOUT",
		strconv.Itoa(readTimeoutSec),
		readTimeoutSec,
	)

	switch dbType {
	case "mysql":
		// MySQL driver expects duration strings; we append "s" so env can be plain integers.
		return fmt.Sprintf(
			"%s:%s@tcp(%s:%s)/%s?tls=true&parseTime=true&timeout=%ds&readTimeout=%ds&writeTimeout=%ds",
			user, password, host, port, database,
			connTimeoutSec, readTimeoutSec, writeTimeoutSec,
		)

	case "postgres":
		if connTimeoutSec < 1 {
			connTimeoutSec = 1
		}

		statementTimeoutMs := statementTimeoutSec * 1000
		if statementTimeoutMs < 1 {
			statementTimeoutMs = 60000
		}

		return fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s connect_timeout=%d options='-c statement_timeout=%d'",
			host, port, user, password, database, sslMode, connTimeoutSec, statementTimeoutMs,
		)

	default:
		return fmt.Sprintf(
			"%s:%s@tcp(%s:%s)/%s?parseTime=true",
			user, password, host, port, database,
		)
	}
}

// parseCommaList splits a comma-separated string, trims whitespace, and drops empty entries.
func parseCommaList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

// getEnvWithFallback tries PREFIX+key first, then globalKey, then fallback.
func getEnvWithFallback(prefix, key, globalKey, fallback string) string {
	return getEnv(prefix+key, getEnv(globalKey, fallback))
}

// getEnv retrieves the value of the environment variable for the given key.
// If the variable is not set or empty, it returns the provided defaultValue.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// parseInt fetches an environment variable by key, attempts to convert it
// into an integer, and returns it. If conversion fails, it logs a warning
// and returns the provided fallback integer.
func parseInt(logger *zap.Logger, key, defaultValue string, fallback int) int {
	v := getEnv(key, defaultValue)
	i, err := strconv.Atoi(v)
	if err != nil {
		logger.Warn(fmt.Sprintf("Invalid %s, using default", key),
			zap.String("value", v),
			zap.Int("default", fallback),
			zap.Error(err))
		return fallback
	}
	return i
}

// parseDuration reads a duration string from the environment using the given key,
// parses it into a time.Duration, and returns it. If parsing fails, it logs a warning
// and returns the fallback duration.
func parseDuration(logger *zap.Logger, key, defaultValue string, fallback time.Duration) time.Duration {
	v := getEnv(key, defaultValue)
	d, err := time.ParseDuration(v)
	if err != nil {
		logger.Warn(fmt.Sprintf("Invalid %s, using default", key),
			zap.String("value", v),
			zap.Duration("default", fallback),
			zap.Error(err))
		return fallback
	}
	if d <= 0 {
		return fallback
	}
	return d
}

// parseBool converts a string into a boolean.
func parseBool(value string) bool {
	v := strings.ToLower(strings.TrimSpace(value))
	return v == "true" || v == "1" || v == "yes"
}
