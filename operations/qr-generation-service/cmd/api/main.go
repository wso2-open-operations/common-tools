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
package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/wso2-open-operations/common-tools/operations/qr-generation-service/internal/config"
	"github.com/wso2-open-operations/common-tools/operations/qr-generation-service/internal/logger"
	"github.com/wso2-open-operations/common-tools/operations/qr-generation-service/internal/qr"
	transport "github.com/wso2-open-operations/common-tools/operations/qr-generation-service/internal/transport/http"
)

func main() {
	log := logger.InitLogger()
	log.Debug("Starting QR generation service initialization")

	cfg := config.LoadConfig()
	log.Debug("Configuration loaded",
		"port", cfg.Port,
		"read_timeout", cfg.ReadTimeout,
		"write_timeout", cfg.WriteTimeout,
		"max_body_size", cfg.MaxBodySize,
	)

	svc := qr.NewService(log, cfg.MinSize, cfg.MaxSize)
	log.Debug("QR service initialized")

	h := transport.NewHandler(svc, log, cfg.MaxBodySize, cfg.MinSize, cfg.MaxSize)
	log.Debug("HTTP handler initialized", "max_body_size", cfg.MaxBodySize)

	// Apply middleware to handlers
	generateHandler := transport.MethodMiddleware(http.MethodPost)(http.HandlerFunc(h.Generate))
	generateHandler = transport.RequestLoggingMiddleware(log)(generateHandler)

	healthHandler := transport.RequestLoggingMiddleware(log)(http.HandlerFunc(h.HealthCheck))

	mux := http.NewServeMux()
	mux.Handle("/generate", generateHandler)
	mux.Handle("/health", healthHandler)
	log.Debug("HTTP routes registered", "endpoints", []string{"/generate", "/health"})

	// Configure HTTP server with timeouts and security settings
	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.Port),
		Handler:           mux,
		ReadTimeout:       cfg.ReadTimeout,
		ReadHeaderTimeout: 2 * time.Second,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       60 * time.Second,
	}
	log.Debug("HTTP server configured",
		"addr", srv.Addr,
		"read_timeout", cfg.ReadTimeout,
		"write_timeout", cfg.WriteTimeout,
	)

	serverErr := make(chan error, 1)
	go func() {
		log.Info("Starting server", "port", cfg.Port, "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	quit := make(chan os.Signal, 2)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit

	log.Info("Shutdown signal received", "signal", sig.String())
	log.Debug("Initiating graceful shutdown", "timeout", cfg.ShutdownTimeout)

	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error("Server forced to shutdown", "error", err, "timeout", cfg.ShutdownTimeout)
		if errors.Is(err, context.DeadlineExceeded) {
			log.Warn("Shutdown timeout exceeded, closing connections")
			srv.Close()
		}
		os.Exit(1)
	}

	log.Info("Server exited gracefully")
}
