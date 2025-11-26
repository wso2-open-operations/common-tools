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
// under the License.ent.

// Package model contains all data structures, BigQuery schemas, and data transformation methods.
// It acts as the "model" layer for the ETL pipeline.
package model

import (
	"database/sql"
	"time"

	"cloud.google.com/go/bigquery"
	"go.uber.org/zap"
)

// Savable defines the interface for types that can be converted to a map for storage.
type Savable interface {
	ToSaveable() map[string]any
}

// BQTable represents a BigQuery table with its name and schema.
type BQTable struct {
	Name   string
	Schema bigquery.Schema
}

// DynamicRow represents a row of data with dynamic columns.
type DynamicRow struct {
	ColumnNames []string
	Values      []any
}

// TableConfig holds configuration for a single table to sync.
type TableConfig struct {
	Name            string   // Source table name
	TargetTable     string   // Target BigQuery table name (optional, defaults to source name)
	PrimaryKey      string   // Primary key column for incremental sync
	TimestampColumn string   // Column to track changes (e.g., updated_at)
	Columns         []string // Specific columns to sync (empty means all columns)
	BatchSize       int      // Number of rows per batch (0 = use default)
	Enabled         bool     // Whether this table sync is enabled
}

// DatabaseConfig holds configuration for a single database source.
type DatabaseConfig struct {
	Name             string
	Type             string
	Host             string
	Port             string
	DatabaseName     string
	User             string
	ConnectionString string
	Tables           map[string]*TableConfig
	Enabled          bool
}

// Config holds all application configuration.
type Config struct {
	GCPProjectID      string
	BigQueryDatasetID string

	Databases map[string]*DatabaseConfig

	SyncTimeout      time.Duration
	DateFormat       string
	DefaultBatchSize int

	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration

	DryRun         bool
	CreateTables   bool
	TruncateOnSync bool
}

// Job represents a sync job for a specific table.
type Job struct {
	Name             string
	DatabaseName     string
	DatabaseType     string
	ConnectionString string
	SourceTable      string
	TargetTable      string
	Query            string
	Columns          []string
	PrimaryKey       string
	TimestampColumn  string
	BatchSize        int
	ParseFunc        func(*sql.Rows, *zap.Logger) (Savable, error)
}

// SyncResult holds the result of a sync operation.
type SyncResult struct {
	DatabaseName string
	TableName    string
	TargetTable  string
	RowsSynced   int64
	Duration     time.Duration
	Error        error
	StartedAt    time.Time
	CompletedAt  time.Time
}

// SyncSummary holds the overall sync summary.
type SyncSummary struct {
	TotalDatabases  int
	TotalTables     int
	SuccessfulSyncs int
	FailedSyncs     int
	TotalRowsSynced int64
	TotalDuration   time.Duration
	Results         []*SyncResult
}

// DataSource represents a data source for backward compatibility.
type DataSource struct {
	Name         string
	DSN          string
	DBName       string
	SourceTables []string
}

// SchemasMatch validates equality of two BigQuery schemas by comparing field names and types.
// Records debug and warning logs for field count differences and type mismatches.
// Returns true only if no missing or mismatched fields are detected.
func SchemasMatch(s1, s2 bigquery.Schema, logger *zap.Logger) bool {
	logger.Debug("Comparing BigQuery schemas",
		zap.Int("schema1_fields", len(s1)),
		zap.Int("schema2_fields", len(s2)))
	if len(s1) != len(s2) {
		logger.Warn("Schema field count mismatch",
			zap.Int("schema1_count", len(s1)),
			zap.Int("schema2_count", len(s2)))
		return false
	}
	mapS1 := make(map[string]bigquery.FieldType)
	for _, field := range s1 {
		mapS1[field.Name] = field.Type
	}
	mismatches := []string{}
	for _, field := range s2 {
		if t, ok := mapS1[field.Name]; !ok {
			mismatches = append(mismatches, "missing:"+field.Name)
		} else if t != field.Type {
			mismatches = append(mismatches, "type:"+field.Name)
		}
	}
	if len(mismatches) > 0 {
		logger.Warn("Schema mismatches detected",
			zap.Strings("mismatches", mismatches))
		return false
	}
	logger.Debug("Schemas match")
	return true
}

// ToSaveable converts a DynamicRow into a map representation using column names as keys.
// Iterates through all columns and assigns corresponding values from the row.
// Returns a generic map[string]any suitable for serialization or database storage.
func (r *DynamicRow) ToSaveable() map[string]any {
	result := make(map[string]any)
	for i, colName := range r.ColumnNames {
		result[colName] = r.Values[i]
	}
	return result
}

// GetEnabledDatabases returns a slice of enabled database configurations.
func (c *Config) GetEnabledDatabases() []*DatabaseConfig {
	var enabled []*DatabaseConfig
	for _, db := range c.Databases {
		if db.Enabled {
			enabled = append(enabled, db)
		}
	}
	return enabled
}

// GetEnabledTables returns a slice of enabled table configurations for a database.
func (db *DatabaseConfig) GetEnabledTables() []*TableConfig {
	var enabled []*TableConfig
	for _, tbl := range db.Tables {
		if tbl.Enabled {
			enabled = append(enabled, tbl)
		}
	}
	return enabled
}

// GetTargetTableName returns the target BigQuery table name.
// If TargetTable is not set, returns the source table name.
func (t *TableConfig) GetTargetTableName() string {
	if t.TargetTable != "" {
		return t.TargetTable
	}
	return t.Name
}

// GetBatchSize returns the batch size to use for this table.
// Returns the table-specific batch size if set, otherwise returns the provided default.
func (t *TableConfig) GetBatchSize(defaultSize int) int {
	if t.BatchSize > 0 {
		return t.BatchSize
	}
	return defaultSize
}

// CountEnabledTables returns the total number of enabled tables across all enabled databases.
func (c *Config) CountEnabledTables() int {
	count := 0
	for _, db := range c.GetEnabledDatabases() {
		count += len(db.GetEnabledTables())
	}
	return count
}
