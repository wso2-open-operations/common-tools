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

	DryRunKey         = "DRY_RUN"
	CreateTablesKey   = "AUTO_CREATE_TABLES"
	TruncateOnSyncKey = "TRUNCATE_ON_SYNC"
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
	dbList := strings.Split(dbNames, ",")

	for _, dbName := range dbList {
		dbName = strings.TrimSpace(dbName)
		if dbName == "" {
			continue
		}

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

	syncTimeout := parseDuration(logger, SyncTimeoutKey, "10m", 10*time.Minute)
	connMaxLifetime := parseDuration(logger, DBConnMaxLifetime, "1m", 1*time.Minute)

	dryRun := parseBool(getEnv(DryRunKey, "false"))
	createTables := parseBool(getEnv(CreateTablesKey, "true"))
	truncateOnSync := parseBool(getEnv(TruncateOnSyncKey, "false"))

	cfg := &model.Config{
		GCPProjectID:      gcpProjectID,
		BigQueryDatasetID: bqDatasetID,
		Databases:         databases,
		SyncTimeout:       syncTimeout,
		DateFormat:        getEnv(DateFormatKey, "2006-01-02T15:04:05Z07:00"),
		DefaultBatchSize:  defaultBatchSize,
		MaxOpenConns:      maxOpen,
		MaxIdleConns:      maxIdle,
		ConnMaxLifetime:   connMaxLifetime,
		DryRun:            dryRun,
		CreateTables:      createTables,
		TruncateOnSync:    truncateOnSync,
	}

	logger.Info("Configuration loaded successfully",
		zap.String("gcp_project", cfg.GCPProjectID),
		zap.String("bq_dataset", cfg.BigQueryDatasetID),
		zap.Int("database_count", len(databases)),
		zap.Bool("dry_run", cfg.DryRun),
	)

	return cfg, nil
}

// loadDatabaseConfig loads configuration for a specific database.
// Environment variables are prefixed with the database identifier in uppercase.
// Example: For database "finance", use FINANCE_DB_HOST, FINANCE_DB_NAME, etc.
func loadDatabaseConfig(logger *zap.Logger, dbID string) (*model.DatabaseConfig, error) {
	prefix := strings.ToUpper(dbID) + "_"

	host := getEnv(prefix+"DB_HOST", getEnv(DefaultDBHost, "localhost"))
	port := getEnv(prefix+"DB_PORT", getEnv(DefaultDBPort, "3306"))
	dbType := getEnv(prefix+"DB_TYPE", getEnv(DefaultDBType, "mysql"))
	database := getEnv(prefix+"DB_NAME", "")
	user := getEnv(prefix+"DB_USER", "")
	password := getEnv(prefix+"DB_PASSWORD", "")
	enabled := parseBool(getEnv(prefix+"ENABLED", "true"))

	if database == "" || user == "" {
		return nil, fmt.Errorf("missing required config: %sDB_NAME and %sDB_USER are required", prefix, prefix)
	}

	connString := buildConnectionString(dbType, host, port, database, user, password, prefix)

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
	prefix := strings.ToUpper(dbID) + "_"
	tablesStr := getEnv(prefix+"TABLES", "")

	if tablesStr == "" {
		return nil, fmt.Errorf("%sTABLES is required (comma-separated list of table names)", prefix)
	}

	tables := make(map[string]*model.TableConfig)
	tableList := strings.Split(tablesStr, ",")

	for _, tableName := range tableList {
		tableName = strings.TrimSpace(tableName)
		if tableName == "" {
			continue
		}

		tableConfig := loadTableConfig(logger, dbID, tableName)
		tables[tableName] = tableConfig
	}

	if len(tables) == 0 {
		return nil, fmt.Errorf("no valid tables found for database '%s'", dbID)
	}

	return tables, nil
}

// loadTableConfig loads configuration for a specific table.
// Environment variables are prefixed with {DB_ID}_{TABLE_NAME}_ in uppercase.
func loadTableConfig(logger *zap.Logger, dbID, tableName string) *model.TableConfig {
	prefix := strings.ToUpper(dbID) + "_" + strings.ToUpper(tableName) + "_"

	targetTable := getEnv(prefix+"TARGET_TABLE", tableName)
	primaryKey := getEnv(prefix+"PRIMARY_KEY", "id")
	timestampCol := getEnv(prefix+"TIMESTAMP_COLUMN", "")
	columnsStr := getEnv(prefix+"COLUMNS", "")
	batchSize := parseInt(logger, prefix+"BATCH_SIZE", "0", 0)
	enabled := parseBool(getEnv(prefix+"ENABLED", "true"))

	var columns []string
	if columnsStr != "" {
		for _, col := range strings.Split(columnsStr, ",") {
			col = strings.TrimSpace(col)
			if col != "" {
				columns = append(columns, col)
			}
		}
	}

	return &model.TableConfig{
		Name:            tableName,
		TargetTable:     targetTable,
		PrimaryKey:      primaryKey,
		TimestampColumn: timestampCol,
		Columns:         columns,
		BatchSize:       batchSize,
		Enabled:         enabled,
	}
}

// buildConnectionString creates a database connection string based on type
func buildConnectionString(dbType, host, port, database, user, password, prefix string) string {
	connTimeout := getEnv(prefix+"DB_CONN_TIMEOUT", "30s")
	readTimeout := getEnv(prefix+"DB_READ_TIMEOUT", "60s")
	writeTimeout := getEnv(prefix+"DB_WRITE_TIMEOUT", "60s")

	switch dbType {
	case "mysql":
		return fmt.Sprintf(
			"%s:%s@tcp(%s:%s)/%s?tls=true&parseTime=true&timeout=%s&readTimeout=%s&writeTimeout=%s",
			user, password, host, port, database,
			connTimeout, readTimeout, writeTimeout,
		)
	case "postgres":
		return fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=require connect_timeout=30",
			host, port, user, password, database,
		)
	default:
		return fmt.Sprintf(
			"%s:%s@tcp(%s:%s)/%s?parseTime=true",
			user, password, host, port, database,
		)
	}
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
	return d
}

// parseBool converts a string into a boolean. It returns true for common
// truthy values ("true", "1", "yes") and false otherwise.
func parseBool(value string) bool {
	v := strings.ToLower(strings.TrimSpace(value))
	return v == "true" || v == "1" || v == "yes"
}
