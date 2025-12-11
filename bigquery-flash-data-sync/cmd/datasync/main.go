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

// Package main is the entry point for the BigQuery data synchronization application.
// This tool syncs data from any SQL databases (MySQL, PostgreSQL) to Google BigQuery.
// It supports configuring multiple databases and tables via environment variables.
package main

import (
	"context"
	"os/user"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"

	"github.com/wso2-open-operations/common-tools/bigquery-flash-data-sync/internal/config"
	"github.com/wso2-open-operations/common-tools/bigquery-flash-data-sync/internal/logger"
	"github.com/wso2-open-operations/common-tools/bigquery-flash-data-sync/internal/model"
	"github.com/wso2-open-operations/common-tools/bigquery-flash-data-sync/internal/pipeline"

	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

// Version information (set via ldflags during build)
var (
	Version   = "dev"
	BuildTime = "unknown"
	GitCommit = "unknown"
)

// main initializes logging, configuration, and starts the sync pipeline.
func main() {
	// Initialize logger first
	logger.InitLogger()
	defer logger.Sync()

	// Get current OS user
	currentUser, err := user.Current()
	username := "unknown"
	if err == nil {
		username = currentUser.Username
	}

	// Log application startup with version info
	logger.Logger.Info("Starting BigQuery Data Sync Tool",
		zap.String("version", Version),
		zap.String("build_time", BuildTime),
		zap.String("git_commit", GitCommit),
		zap.String("user", username),
		zap.String("timestamp", time.Now().Format(time.RFC3339)),
	)

	// Load .env file (optional in production)
	if err := godotenv.Load(); err != nil {
		logger.Logger.Debug("No .env file found, using environment variables")
	} else {
		logger.Logger.Info(".env file loaded successfully")
	}

	// Load application configuration
	logger.Logger.Info("Loading application configuration")
	cfg, err := config.LoadConfig(logger.Logger)
	if err != nil {
		logger.Logger.Fatal("Failed to load configuration", zap.Error(err))
	}

	// Log configuration summary
	logConfigSummary(cfg)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), cfg.SyncTimeout)
	defer cancel()

	// Run the sync pipeline
	logger.Logger.Info("Starting data sync pipeline",
		zap.Duration("timeout", cfg.SyncTimeout),
		zap.Bool("dry_run", cfg.DryRun),
	)

	if err := pipeline.Start(ctx, cfg, logger.Logger); err != nil {
		logger.Logger.Fatal("Data sync pipeline failed", zap.Error(err))
	}

	logger.Logger.Info("Data sync completed successfully")
}

// logConfigSummary logs a summary of the loaded configuration
func logConfigSummary(cfg *model.Config) {
	totalTables := 0
	for dbName, dbConfig := range cfg.Databases {
		enabledTables := 0
		for _, tblConfig := range dbConfig.Tables {
			if tblConfig.Enabled {
				enabledTables++
			}
		}
		totalTables += enabledTables
		logger.Logger.Info("Database configured",
			zap.String("name", dbName),
			zap.String("type", dbConfig.Type),
			zap.Bool("enabled", dbConfig.Enabled),
			zap.Int("tables", enabledTables),
		)
	}

	logger.Logger.Info("Configuration summary",
		zap.String("gcp_project", cfg.GCPProjectID),
		zap.String("bq_dataset", cfg.BigQueryDatasetID),
		zap.Int("databases", len(cfg.Databases)),
		zap.Int("total_tables", totalTables),
	)
}
