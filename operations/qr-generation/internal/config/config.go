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
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// Package config provides configuration management for the QR generation service.
// It loads configuration from environment variables with sensible defaults.
package config

import (
	"os"
	"strconv"
	"sync"
	"time"
)

// Config holds application configuration loaded from environment variables.
type Config struct {
	Port            string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
	MaxBodySize     int64
	MinSize         int
	MaxSize         int
	DefaultSize     int
}

var (
	envCache sync.Map
	intCache sync.Map
)

// LoadConfig reads configuration from environment variables and returns a Config instance.
func LoadConfig() *Config {
	return &Config{
		Port:            getEnv("PORT", "8080"),
		ReadTimeout:     getEnvDuration("READ_TIMEOUT", 5*time.Second),
		WriteTimeout:    getEnvDuration("WRITE_TIMEOUT", 10*time.Second),
		ShutdownTimeout: getEnvDuration("SHUTDOWN_TIMEOUT", 5*time.Second),
		MaxBodySize:     getEnvInt64("MAX_BODY_SIZE", 524288),
		MinSize:         getEnvInt("MIN_SIZE", 64),
		MaxSize:         getEnvInt("MAX_SIZE", 2048),
		DefaultSize:     256,
	}
}

// getEnv retrieves a string environment variable or returns fallback if not set.
func getEnv(key, fallback string) string {
	if cached, ok := envCache.Load(key); ok {
		if val, ok := cached.(string); ok {
			return val
		}
	}

	if value := os.Getenv(key); value != "" {
		envCache.Store(key, value)
		return value
	}
	return fallback
}

// getEnvDuration retrieves a duration environment variable or returns fallback.
func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if value, exists := os.LookupEnv(key); exists {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return fallback
}

// getEnvInt retrieves an int environment variable or returns fallback (only accepts positive values).
func getEnvInt(key string, fallback int) int {
	if cached, ok := intCache.Load(key); ok {
		if val, ok := cached.(int); ok {
			return val
		}
	}

	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil && i > 0 {
			intCache.Store(key, i)
			return i
		}
	}
	return fallback
}

// getEnvInt64 retrieves an int64 environment variable or returns fallback (only accepts positive values).
func getEnvInt64(key string, fallback int64) int64 {
	if value, exists := os.LookupEnv(key); exists {
		if i, err := strconv.ParseInt(value, 10, 64); err == nil {
			if i > 0 {
				return i
			}
		}
	}
	return fallback
}
