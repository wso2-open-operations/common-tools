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

// Waste-management backend: fronts a private Google Sheet with a small,
// cached, read-only REST API for the TV dashboard. Configured via
// environment variables (.env seeds unset keys locally).
package main

import (
	"bufio"
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/wso2-open-operations/common-tools/apps/waste-management/backend/internal/config"
	"github.com/wso2-open-operations/common-tools/apps/waste-management/backend/internal/handler"
	"github.com/wso2-open-operations/common-tools/apps/waste-management/backend/internal/middleware"
	"github.com/wso2-open-operations/common-tools/apps/waste-management/backend/internal/sheets"
)

func main() {
	loadDotEnv(".env")

	cfg, err := config.Load()
	if err != nil {
		slog.Error("configuration", "err", err)
		os.Exit(1)
	}

	sheetsClient := sheets.NewClient(cfg.Sheets)
	wasteHandler := handler.NewWasteHandler(sheetsClient, cfg.CacheTTL)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handler.Health)
	mux.HandleFunc("GET /api/waste", wasteHandler.GetWaste)

	ln, err := net.Listen("tcp", ":"+cfg.Port)
	if err != nil {
		slog.Error("failed to bind", "port", cfg.Port, "err", err)
		os.Exit(1)
	}
	slog.Info("waste-management backend started", "port", cfg.Port)

	srv := &http.Server{
		Handler: middleware.CORS(cfg.CORSAllowedOrigin,
			middleware.CorrelationID(
				middleware.Logger(mux),
			),
		),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server exited", "err", err)
			stop()
		}
	}()

	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "err", err)
		os.Exit(1)
	}
	slog.Info("waste-management backend stopped")
}

// loadDotEnv does a minimal parse of a .env file for local development
// convenience. Values already set in the environment win. Choreo (and any
// real deployment) sets env vars directly, so this file is never required
// outside a developer's machine.
func loadDotEnv(path string) {
	f, err := os.Open(path) // #nosec G304 -- path is always the hardcoded literal ".env" at the only call site
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			slog.Warn("loadDotEnv: failed to open .env file", "err", err)
		}
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"`)
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
	if err := scanner.Err(); err != nil {
		slog.Warn("loadDotEnv: error reading .env file", "err", err)
	}
}
