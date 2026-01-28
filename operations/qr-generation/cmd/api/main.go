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

// Package main is the entry point for the QR code generation service.
// This HTTP service generates QR codes from text or URLs and returns them as PNG images.
// It provides a RESTful API with configurable size and health check endpoints.

package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/wso2-open-operations/common-tools/operations/qr-generation/internal/config"
	"github.com/wso2-open-operations/common-tools/operations/qr-generation/internal/qr"
	transport "github.com/wso2-open-operations/common-tools/operations/qr-generation/internal/transport/http"
)

func main() {
	cfg := config.LoadConfig()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	svc := qr.NewService()
	h := transport.NewHandler(svc, logger, cfg.MaxBodySize)

	mux := http.NewServeMux()
	mux.HandleFunc("/generate", h.Generate)
	mux.HandleFunc("/health", h.HealthCheck)

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.Port),
		Handler:           mux,
		ReadTimeout:       cfg.ReadTimeout,
		ReadHeaderTimeout: 2 * time.Second,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info("Starting server", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	logger.Info("Server exited")
}
