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

// Package pipeline provides schema inference, validation, and data-loading utilities
// used to synchronize SQL source tables (MySQL, PostgreSQL) with BigQuery in a structured ETL workflow.
// It supports multiple database types and dynamic table configuration.
package pipeline

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"

	"github.com/wso2-open-operations/common-tools/bigquery-flash-data-sync/internal/model"

	"cloud.google.com/go/bigquery"
	"go.uber.org/zap"
)

// validIdentifierRegex matches valid BigQuery identifiers.
// BigQuery identifiers can contain letters (a-z, A-Z), digits (0-9), underscores (_), and hyphens (-).
// They must start with a letter or underscore.
var validIdentifierRegex = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_-]*$`)

// validateBigQueryIdentifier checks if an identifier is safe for use in BigQuery queries.
// Returns an error if the identifier contains invalid characters that could enable SQL injection.
func validateBigQueryIdentifier(identifier string, identifierType string) error {
	if identifier == "" {
		return fmt.Errorf("%s cannot be empty", identifierType)
	}
	if len(identifier) > 1024 {
		return fmt.Errorf("%s exceeds maximum length of 1024 characters", identifierType)
	}
	if !validIdentifierRegex.MatchString(identifier) {
		return fmt.Errorf("%s '%s' contains invalid characters; must match pattern [a-zA-Z_][a-zA-Z0-9_-]*", identifierType, identifier)
	}
	return nil
}

// InferSchemaFromDatabase infers a BigQuery schema from a SQL database query.
// Supports MySQL and PostgreSQL database types.
func InferSchemaFromDatabase(db *sql.DB, dbType string, query string, logger *zap.Logger) (bigquery.Schema, error) {
	logger.Debug("Inferring schema from database",
		zap.String("db_type", dbType),
		zap.String("query", query))

	switch dbType {
	case "mysql":
		return InferSchemaFromMySQL(db, query, logger)
	case "postgres":
		return InferSchemaFromPostgres(db, query, logger)
	default:
		logger.Warn("Unknown database type, defaulting to MySQL inference",
			zap.String("db_type", dbType))
		return InferSchemaFromMySQL(db, query, logger)
	}
}

// mysqlTypeToBigQueryType maps common MySQL database types to BigQuery types.
func mysqlTypeToBigQueryType(mysqlType string, logger *zap.Logger) bigquery.FieldType {
	t := strings.ToUpper(strings.Split(mysqlType, "(")[0])
	switch t {
	case "VARCHAR", "CHAR", "TEXT", "TINYTEXT", "MEDIUMTEXT", "LONGTEXT", "ENUM", "SET":
		return bigquery.StringFieldType
	case "INT", "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT", "INTEGER":
		return bigquery.IntegerFieldType
	case "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL":
		return bigquery.FloatFieldType
	case "DATE":
		return bigquery.DateFieldType
	case "TIME":
		return bigquery.TimeFieldType
	case "DATETIME", "TIMESTAMP":
		return bigquery.TimestampFieldType
	case "BOOLEAN", "BOOL", "BIT":
		return bigquery.BooleanFieldType
	case "BLOB", "TINYBLOB", "MEDIUMBLOB", "LONGBLOB", "BINARY", "VARBINARY":
		return bigquery.BytesFieldType
	case "JSON":
		return bigquery.JSONFieldType
	default:
		logger.Warn("Unknown MySQL type, defaulting to STRING",
			zap.String("mysql_type", mysqlType),
			zap.String("default_type", "STRING"))
		return bigquery.StringFieldType
	}
}

// postgresTypeToBigQueryType maps common PostgreSQL database types to BigQuery types.
func postgresTypeToBigQueryType(pgType string, logger *zap.Logger) bigquery.FieldType {
	t := strings.ToUpper(strings.Split(pgType, "(")[0])
	t = strings.TrimSuffix(t, "[]")

	switch t {
	case "VARCHAR", "CHAR", "CHARACTER", "CHARACTER VARYING", "TEXT", "NAME", "UUID", "CITEXT":
		return bigquery.StringFieldType
	case "INT", "INT2", "INT4", "INT8", "INTEGER", "SMALLINT", "BIGINT", "SERIAL", "BIGSERIAL", "SMALLSERIAL":
		return bigquery.IntegerFieldType
	case "FLOAT", "FLOAT4", "FLOAT8", "DOUBLE", "DOUBLE PRECISION", "DECIMAL", "NUMERIC", "REAL", "MONEY":
		return bigquery.FloatFieldType
	case "DATE":
		return bigquery.DateFieldType
	case "TIME", "TIMETZ", "TIME WITH TIME ZONE", "TIME WITHOUT TIME ZONE":
		return bigquery.TimeFieldType
	case "TIMESTAMP", "TIMESTAMPTZ", "TIMESTAMP WITH TIME ZONE", "TIMESTAMP WITHOUT TIME ZONE":
		return bigquery.TimestampFieldType
	case "BOOLEAN", "BOOL":
		return bigquery.BooleanFieldType
	case "BYTEA":
		return bigquery.BytesFieldType
	case "JSON", "JSONB":
		return bigquery.JSONFieldType
	case "INET", "CIDR", "MACADDR", "MACADDR8":
		return bigquery.StringFieldType
	case "INTERVAL":
		return bigquery.StringFieldType
	case "POINT", "LINE", "LSEG", "BOX", "PATH", "POLYGON", "CIRCLE":
		return bigquery.StringFieldType
	default:
		logger.Warn("Unknown PostgreSQL type, defaulting to STRING",
			zap.String("postgres_type", pgType),
			zap.String("default_type", "STRING"))
		return bigquery.StringFieldType
	}
}

// InferSchemaFromMySQL connects to the source DB, runs a LIMIT 1 query,
// and builds a BigQuery Schema based on the returned column types.
func InferSchemaFromMySQL(db *sql.DB, query string, logger *zap.Logger) (bigquery.Schema, error) {
	logger.Debug("Inferring schema from MySQL database")

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("schema inference query failed: %w", err)
	}
	defer rows.Close()

	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, fmt.Errorf("failed to get column types for inference: %w", err)
	}
	logger.Debug("Retrieved column types for schema inference",
		zap.Int("column_count", len(columnTypes)))

	schema := make(bigquery.Schema, 0, len(columnTypes))
	for _, col := range columnTypes {
		bqType := mysqlTypeToBigQueryType(col.DatabaseTypeName(), logger)
		nullable, ok := col.Nullable()
		field := &bigquery.FieldSchema{
			Name:     col.Name(),
			Type:     bqType,
			Required: ok && !nullable,
		}
		schema = append(schema, field)
		logger.Debug("Mapped column to BigQuery field",
			zap.String("column_name", col.Name()),
			zap.String("mysql_type", col.DatabaseTypeName()),
			zap.String("bigquery_type", string(bqType)),
			zap.Bool("required", field.Required))
	}

	logger.Info("MySQL schema inference complete",
		zap.Int("fields_mapped", len(schema)))

	return schema, nil
}

// InferSchemaFromPostgres connects to the source PostgreSQL DB, runs a LIMIT 1 query,
// and builds a BigQuery Schema based on the returned column types.
func InferSchemaFromPostgres(db *sql.DB, query string, logger *zap.Logger) (bigquery.Schema, error) {
	logger.Debug("Inferring schema from PostgreSQL database")

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("schema inference query failed: %w", err)
	}
	defer rows.Close()

	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, fmt.Errorf("failed to get column types for inference: %w", err)
	}
	logger.Debug("Retrieved column types for schema inference",
		zap.Int("column_count", len(columnTypes)))

	schema := make(bigquery.Schema, 0, len(columnTypes))
	for _, col := range columnTypes {
		bqType := postgresTypeToBigQueryType(col.DatabaseTypeName(), logger)
		nullable, ok := col.Nullable()
		field := &bigquery.FieldSchema{
			Name:     col.Name(),
			Type:     bqType,
			Required: ok && !nullable,
		}
		schema = append(schema, field)
		logger.Debug("Mapped column to BigQuery field",
			zap.String("column_name", col.Name()),
			zap.String("postgres_type", col.DatabaseTypeName()),
			zap.String("bigquery_type", string(bqType)),
			zap.Bool("required", field.Required))
	}

	logger.Info("PostgreSQL schema inference complete",
		zap.Int("fields_mapped", len(schema)))

	return schema, nil
}

// createOrUpdateTable ensures that a target table in BigQuery exists and that its schema matches the provided schema.
// If the table does not exist, it is created. If the schema differs, the table schema is updated.
func createOrUpdateTable(ctx context.Context, client *bigquery.Client, datasetID string, table model.BQTable, logger *zap.Logger) error {
	logger.Info("Checking BigQuery table",
		zap.String("dataset", datasetID),
		zap.String("table", table.Name))

	tableRef := client.Dataset(datasetID).Table(table.Name)
	metadata, err := tableRef.Metadata(ctx)

	if err != nil {
		// Check if table doesn't exist
		if strings.Contains(err.Error(), "Not found") || strings.Contains(err.Error(), "notFound") {
			logger.Info("Table not found, creating new table",
				zap.String("table", table.Name),
				zap.Int("schema_fields", len(table.Schema)))

			err = tableRef.Create(ctx, &bigquery.TableMetadata{
				Name:   table.Name,
				Schema: table.Schema,
			})
			if err != nil {
				return fmt.Errorf("failed to create table '%s': %w", table.Name, err)
			}

			logger.Info("Table created successfully",
				zap.String("table", table.Name))
			return nil
		}
		return fmt.Errorf("failed to get table metadata for '%s': %w", table.Name, err)
	}

	// Table exists, check if schema matches
	if !model.SchemasMatch(metadata.Schema, table.Schema, logger) {
		logger.Warn("Schema mismatch detected, attempting update",
			zap.String("table", table.Name),
			zap.Int("existing_fields", len(metadata.Schema)),
			zap.Int("new_fields", len(table.Schema)))

		update := bigquery.TableMetadataToUpdate{Schema: table.Schema}
		_, updateErr := tableRef.Update(ctx, update, metadata.ETag)

		if updateErr != nil {
			// Check for critical schema errors that require table recreation
			isCriticalError := (strings.Contains(updateErr.Error(), "changed type") ||
				strings.Contains(updateErr.Error(), "is missing") ||
				strings.Contains(updateErr.Error(), "Precondition")) &&
				(strings.Contains(updateErr.Error(), "invalid") ||
					strings.Contains(updateErr.Error(), "cannot"))

			if isCriticalError {
				logger.Error("Critical schema error detected, recreating table",
					zap.String("table", table.Name),
					zap.Error(updateErr))

				logger.Warn("WARNING: Recreating table will DELETE ALL EXISTING DATA",
					zap.String("table", table.Name))

				// Delete existing table
				if delErr := tableRef.Delete(ctx); delErr != nil {
					return fmt.Errorf("failed to delete table '%s' with bad schema: %w", table.Name, delErr)
				}
				logger.Info("Table deleted", zap.String("table", table.Name))

				// Recreate table with new schema
				if createErr := tableRef.Create(ctx, &bigquery.TableMetadata{
					Name:   table.Name,
					Schema: table.Schema,
				}); createErr != nil {
					return fmt.Errorf("failed to recreate table '%s' with correct schema: %w", table.Name, createErr)
				}

				logger.Info("Table successfully recreated with corrected schema",
					zap.String("table", table.Name))
				return nil
			}

			return fmt.Errorf("failed to update table schema for '%s': %w", table.Name, updateErr)
		}

		logger.Info("Table schema updated successfully",
			zap.String("table", table.Name))
	} else {
		logger.Debug("Table schema is up to date",
			zap.String("table", table.Name))
	}

	return nil
}
