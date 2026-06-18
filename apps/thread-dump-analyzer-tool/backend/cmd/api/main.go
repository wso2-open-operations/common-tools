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
	"context"
	"log/slog"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/analyzer"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/config"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/job"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/logger"
	transporthttp "github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/transport/http"
)

func main() {
	// godotenv must run before logger.Init so LOG_LEVEL from .env is honored.
	envErr := godotenv.Load()
	logger.Init()
	if envErr != nil {
		slog.Info("no .env file found, relying on environment variables")
	}

	cfg := config.LoadConfig()

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
	jobStore := job.NewJobStore(cfg)

	ipLimiter := transporthttp.NewIPLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst, cfg.RateLimitVisitorTTL, cfg.RateLimitJanitorTick)
	jobLimiter := job.NewJobLimiter(cfg.MaxConcurrentJobs)

	// Gate the analyze endpoints behind Bearer-JWT auth; fail fast if enabled but unconfigured.
	var requireAuth func(http.HandlerFunc) http.HandlerFunc
	if cfg.AuthEnabled {
		authn, err := transporthttp.NewAuthenticator(context.Background(), cfg)
		if err != nil {
			slog.Error("failed to initialize authentication", "error", err)
			os.Exit(1)
		}
		requireAuth = authn.RequireAuth
		slog.Info("authentication enabled", "issuer", cfg.JWTIssuer, "jwks_url", cfg.JWKSURL, "audience_check", cfg.JWTAudience != "")
	} else {
		slog.Warn("AUTHENTICATION DISABLED — analyze endpoints are publicly accessible; never deploy with AUTH_ENABLED=false")
		requireAuth = func(next http.HandlerFunc) http.HandlerFunc { return next }
	}

	addr := ":" + cfg.Port
	srv := &http.Server{
		Addr:              addr,
		Handler:           transporthttp.NewRouter(cfg, jobStore, engine, enricher, ipLimiter, jobLimiter, requireAuth),
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}

	slog.Info("server listening", "addr", addr, "url", cfg.PublicURL, "max_upload_mib", cfg.MaxUploadBytes>>20)
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
