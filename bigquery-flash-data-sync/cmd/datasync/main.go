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

// Package main is the entry point for the BigQuery data synchronization application.
// It is responsible for loading configuration, setting up database connections,
// and initiating the data transfer pipeline.
package main

import (
	"context"
	"os/user"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"github.com/wso2-enterprise/digiops-finance/bigquery-flash-data-sync/internal/config"
	"github.com/wso2-enterprise/digiops-finance/bigquery-flash-data-sync/internal/logger"
	"github.com/wso2-enterprise/digiops-finance/bigquery-flash-data-sync/internal/pipeline"

	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

// main initializes logging, configuration, security settings, and application context,
// then starts the BigQuery data synchronization pipeline and handles any critical failures.
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

	// Log application initialization
	logger.Logger.Info("Initializing BigQuery Data Sync",
		zap.String("user", username),
		zap.String("timestamp", time.Now().Format(time.RFC3339)),
	)

	// Load .env file to populate environment variables
	if err := godotenv.Load(); err != nil {
		logger.Logger.Warn("No .env file found, using environment variables", zap.Error(err))
	} else {
		logger.Logger.Info(".env file loaded successfully")
	}

	// Load application configuration
	logger.Logger.Info("Loading application configuration")
	cfg, err := config.LoadConfig(logger.Logger)
	if err != nil {
		logger.Logger.Fatal("Failed to load configuration", zap.Error(err))
	}
	logger.Logger.Info("Configuration loaded successfully")
	ctx, cancel := context.WithTimeout(context.Background(), cfg.SyncTimeout)
	defer cancel()
	logger.Logger.Info("Starting data sync pipeline")
	if err := pipeline.Start(ctx, cfg, logger.Logger); err != nil {
		logger.Logger.Fatal("Data sync pipeline failed", zap.Error(err))
	}
	logger.Logger.Info("Data sync completed successfully")
}
