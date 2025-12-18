// Copyright (c) 2025 WSO2 LLC.  (https://www.wso2.com).
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

// Package model provides data parsing utilities for converting SQL rows to saveable formats.
package model

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"go.uber.org/zap"
)

// ParseDynamicRow scans a sql.Rows result into a DynamicRow structure.
// It handles various SQL types and converts them appropriately for BigQuery.
func ParseDynamicRow(rows *sql.Rows, logger *zap.Logger, dateFormat string) (*DynamicRow, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	values := make([]any, len(columns))
	valuePtrs := make([]any, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return nil, fmt.Errorf("failed to scan row: %w", err)
	}

	for i, val := range values {
		values[i] = convertValue(val, dateFormat, logger)
	}

	return &DynamicRow{
		ColumnNames: columns,
		Values:      values,
	}, nil
}

// convertValue converts SQL values to appropriate Go types for BigQuery.
// It sanitizes invalid UTF-8 sequences in byte slices to prevent BigQuery JSON upload failures.
func convertValue(val any, dateFormat string, logger *zap.Logger) any {
    if val == nil {
        return nil
    }

    switch v := val.(type) {
    case []byte:
        s := string(v)
        if !utf8.Valid(v) {
            logger.Debug("Invalid UTF-8 sequence detected, sanitizing",
                zap.Int("original_length", len(v)))
            return strings.ToValidUTF8(s, "")
        }
        return s

    case time.Time:
        if v.IsZero() {
            return nil
        }

        // Heuristic:
        // - If it's a "date-only" value (midnight), format using dateFormat (e.g., 2006-01-02)
        // - Otherwise, return a RFC3339Nano timestamp string (BigQuery-friendly for TIMESTAMP/DATETIME)
        if v.Hour() == 0 && v.Minute() == 0 && v.Second() == 0 && v.Nanosecond() == 0 && dateFormat != "" {
            return v.Format(dateFormat)
        }
        return v.UTC().Format(time.RFC3339Nano)

    case int64, int32, int16, int8, int:
        return v
    case uint64, uint32, uint16, uint8, uint:
        return v
    case float64, float32:
        return v
    case bool:
        return v
    case string:
        if !utf8.ValidString(v) {
            logger.Debug("Invalid UTF-8 string detected, sanitizing",
                zap.Int("original_length", len(v)))
            return strings.ToValidUTF8(v, "")
        }
        return v
    default:
        logger.Debug("Converting unknown type to string",
            zap.String("type", fmt.Sprintf("%T", v)))
        return fmt.Sprintf("%v", v)
    }
}
