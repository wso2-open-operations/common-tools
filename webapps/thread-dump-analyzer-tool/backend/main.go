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

package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/wso2-open-operations/common-tools/webapps/thread-dump-analyzer-tool/backend/internal/ai"
	"github.com/wso2-open-operations/common-tools/webapps/thread-dump-analyzer-tool/backend/internal/analyzer"

	"github.com/joho/godotenv"
)

// Top-level JSON response format for a structured analysis
type AggregatedAnalysisResponse struct {
	SessionID      string                       `json:"session_id"`
	Timestamp      string                       `json:"timestamp"`
	Threads        []analyzer.AnalyzedThread    `json:"threads"`
	ThreadPools    map[string]analyzer.PoolInfo `json:"thread_pools,omitempty"`
	PatternMatches []analyzer.PatternMatch      `json:"pattern_matches,omitempty"`
	AIInsights     *ai.AIInsights               `json:"ai_insights,omitempty"`
	Errors         []string                     `json:"errors,omitempty"`
}

// logLevel is shared across the process so the active log level can be adjusted
// at runtime (e.g. via a future admin endpoint) without rebuilding the handler.
var logLevel = new(slog.LevelVar)

// initLogger installs a slog text handler as the default logger, honoring the
// LOG_LEVEL env var (DEBUG/INFO/WARN/ERROR; defaults to INFO on empty/invalid).
func initLogger() {
	if raw := strings.TrimSpace(os.Getenv("LOG_LEVEL")); raw != "" {
		if err := logLevel.UnmarshalText([]byte(strings.ToUpper(raw))); err != nil {
			logLevel.Set(slog.LevelInfo)
			slog.Warn("invalid LOG_LEVEL, defaulting to INFO", "value", raw, "error", err)
		}
	} else {
		logLevel.Set(slog.LevelInfo)
	}
	handler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: logLevel})
	slog.SetDefault(slog.New(handler))
}

func main() {
	// Load .env file if present (ignore error if not found). godotenv must run
	// before initLogger so LOG_LEVEL from .env is honored.
	envErr := godotenv.Load()
	initLogger()
	if envErr != nil {
		slog.Info("no .env file found, relying on environment variables")
	}

	cfg := LoadConfig()

	// Initialize Rules Engine
	engine, err := analyzer.NewEngine(cfg.RulesPath)
	if err != nil {
		slog.Error("failed to load rules engine", "error", err, "path", cfg.RulesPath)
		os.Exit(1)
	}

	// Initialize Thread Enricher
	enricher, err := analyzer.NewThreadEnricher(cfg.ThreadPoolsPath)
	if err != nil {
		slog.Error("failed to initialize thread enricher", "error", err, "path", cfg.ThreadPoolsPath)
		os.Exit(1)
	}

	// In-memory registry of asynchronous analysis jobs
	jobStore := NewJobStore(cfg)

	addr := ":" + cfg.Port
	srv := &http.Server{
		Addr:              addr,
		Handler:           NewRouter(cfg, jobStore, engine, enricher),
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}

	slog.Info("server listening", "addr", addr, "url", cfg.PublicURL)
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
