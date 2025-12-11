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
// under the License

// Package logger provides centralized logging configuration for the application.
package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Logger *zap.Logger

// InitLogger initializes the global logger based on environment configuration.
// It supports both development and production modes with configurable log levels.
func InitLogger() {
	logEnv := os.Getenv("LOG_ENV")
	logLevel := getLogLevelFromEnv()

	var config zap.Config

	if logEnv == "prod" {
		config = zap.NewProductionConfig()
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	} else {
		config = zap.NewDevelopmentConfig()
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	}

	config.Level = zap.NewAtomicLevelAt(logLevel)

	var err error
	Logger, err = config.Build(
		zap.AddCallerSkip(0),
		zap.AddStacktrace(zapcore.ErrorLevel),
	)
	if err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}

	Logger.Info("Logger initialized",
		zap.String("LOG_ENV", logEnv),
		zap.String("LOG_LEVEL", logLevel.String()))
}

// getLogLevelFromEnv reads the LOG_LEVEL environment variable and returns the corresponding zapcore.Level.
// Defaults to InfoLevel if not set or invalid.
func getLogLevelFromEnv() zapcore.Level {
	level := os.Getenv("LOG_LEVEL")

	switch level {
	case "debug":
		return zapcore.DebugLevel
	case "info":
		return zapcore.InfoLevel
	case "warn":
		return zapcore.WarnLevel
	case "error":
		return zapcore.ErrorLevel
	case "dpanic":
		return zapcore.DPanicLevel
	case "panic":
		return zapcore.PanicLevel
	case "fatal":
		return zapcore.FatalLevel
	default:
		return zapcore.InfoLevel
	}
}

// Sync flushes any buffered log entries.
// Applications should call this before exiting.
func Sync() {
	if Logger != nil {
		_ = Logger.Sync()
	}
}
