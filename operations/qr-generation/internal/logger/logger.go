// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// Package logger provides centralized logging configuration for the QR generation service.
package logger

import (
	"log/slog"
	"os"
	"strings"
	"sync"
)

var (
	initOnce sync.Once
	levelMap = map[string]slog.Level{
		"debug": slog.LevelDebug,
		"info":  slog.LevelInfo,
		"warn":  slog.LevelWarn,
		"error": slog.LevelError,
	}
)

// InitLogger initializes and returns a logger based on LOG_ENV (dev/prod) and LOG_LEVEL (debug/info/warn/error).
func InitLogger() *slog.Logger {
	var logger *slog.Logger
	initOnce.Do(func() {
		logEnv := os.Getenv("LOG_ENV")
		logLevel := getLogLevelFromEnv()

		var handler slog.Handler

		// Production environment: Use JSON format for structured log parsing
		if logEnv == "prod" {
			handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
				Level: logLevel,
			})
		} else {
			// Development environment: Use text format for human readability
			handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
				Level: logLevel,
			})
		}

		logger = slog.New(handler)
		logger.Info(
			"Logger initialized",
			"LOG_ENV", logEnv,
			"LOG_LEVEL", logLevel.String(),
		)
	})
	return logger
}

// getLogLevelFromEnv parses LOG_LEVEL env var (debug/info/warn/error), defaults to info.
func getLogLevelFromEnv() slog.Level {
	levelStr := strings.ToLower(os.Getenv("LOG_LEVEL"))
	if level, ok := levelMap[levelStr]; ok {
		return level
	}
	return slog.LevelInfo
}
