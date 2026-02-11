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

// Package http provides HTTP transport layer for the QR code generation service.
package http

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"sync"

	"github.com/wso2-open-operations/common-tools/operations/qr-generation-service/internal/config"
	"github.com/wso2-open-operations/common-tools/operations/qr-generation-service/internal/qr"
)

// GenerateHandler defines the interface for QR code generation handler.
type GenerateHandler interface {
	http.Handler
	Generate(w http.ResponseWriter, r *http.Request)
}

type Handler struct {
	svc         qr.Service
	logger      *slog.Logger
	maxBodySize int64
	minSize     int
	maxSize     int
	encoderPool sync.Pool
}

// NewHandler creates a new HTTP handler for QR code generation.
func NewHandler(svc qr.Service, logger *slog.Logger, maxBodySize int64, minSize, maxSize int) *Handler {
	return &Handler{
		svc:         svc,
		logger:      logger,
		maxBodySize: maxBodySize,
		minSize:     minSize,
		maxSize:     maxSize,
		encoderPool: sync.Pool{
			New: func() interface{} {
				return json.NewEncoder(io.Discard)
			},
		},
	}
}

// Generate handles POST /generate?size={pixels} requests to create QR codes.
// Accepts raw text/URL in body, returns PNG image.
// Note: Method checking should be handled by middleware for cleaner separation.
func (h *Handler) Generate(w http.ResponseWriter, r *http.Request) {
	// Fast fail for obvious oversized requests
	if r.ContentLength > h.maxBodySize {
		h.logger.Warn("Request body too large (ContentLength check)",
			"content_length", r.ContentLength,
			"max_allowed", h.maxBodySize,
			"remote_addr", r.RemoteAddr,
		)
		http.Error(w, "Request body too large", http.StatusRequestEntityTooLarge)
		return
	}

	// Enforce maximum request body size to prevent DoS attacks
	r.Body = http.MaxBytesReader(w, r.Body, h.maxBodySize)
	h.logger.Debug("Reading request body", "max_size", h.maxBodySize)

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, io.LimitReader(r.Body, h.maxBodySize)); err != nil {
		body := buf.Bytes()
		if len(body) > int(h.maxBodySize) {
			h.logger.Warn("Request body hit size limit",
				"max_allowed", h.maxBodySize,
				"remote_addr", r.RemoteAddr,
			)
			http.Error(w, "Request body too large", http.StatusRequestEntityTooLarge)
			return
		}
		h.logger.Error("failed to read request body", "error", err, "remote_addr", r.RemoteAddr)
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			h.logger.Warn("Request body too large",
				"max_allowed", h.maxBodySize,
				"remote_addr", r.RemoteAddr,
			)
			http.Error(w, "Request body too large", http.StatusRequestEntityTooLarge)
			return
		}
		http.Error(w, "Failed to read request body", http.StatusInternalServerError)
		return
	}

	body := buf.Bytes()
	h.logger.Debug("Request body read successfully", "body_size", len(body))

	if len(body) == 0 {
		h.logger.Warn("Empty request body received", "remote_addr", r.RemoteAddr)
		http.Error(w, "Request body is empty", http.StatusBadRequest)
		return
	}

	const defaultSize = 256
	size := config.DefaultSize
	if config.DefaultSize == 0 {
		size = defaultSize
	}
	sizeStr := r.URL.Query().Get("size")

	if sizeStr != "" {
		h.logger.Debug("Parsing size parameter", "size_str", sizeStr)
		parsedSize, err := strconv.Atoi(sizeStr)
		if err != nil || parsedSize < h.minSize || parsedSize > h.maxSize {
			h.logger.Warn("Invalid size parameter",
				"size_str", sizeStr,
				"error", err,
				"min", h.minSize,
				"max", h.maxSize,
				"remote_addr", r.RemoteAddr,
			)
			http.Error(w, fmt.Sprintf("Invalid size parameter: must be between %d and %d", h.minSize, h.maxSize), http.StatusBadRequest)
			return
		}
		size = parsedSize
		h.logger.Debug("Size parameter parsed", "size", size)
	} else {
		h.logger.Debug("Using default size", "size", defaultSize)
	}

	h.logger.Debug("Calling QR generation service",
		"data_length", len(body),
		"size", size,
	)

	png, err := h.svc.Generate(body, size)
	if err != nil {
		h.logger.Error("failed to generate QR code",
			"error", err,
			"data_length", len(body),
			"size", size,
			"remote_addr", r.RemoteAddr,
		)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	h.logger.Debug("QR code generated successfully",
		"png_size", len(png),
		"remote_addr", r.RemoteAddr,
	)

	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", strconv.Itoa(len(png)))
	w.WriteHeader(http.StatusOK)

	if fl, ok := w.(http.Flusher); ok {
		fl.Flush()
	}

	if _, err := w.Write(png); err != nil {
		h.logger.Error("failed to write response",
			"error", err,
			"png_size", len(png),
			"remote_addr", r.RemoteAddr,
		)
		return
	}

	h.logger.Info("QR code request completed successfully",
		"data_length", len(body),
		"size", size,
		"output_size", len(png),
		"remote_addr", r.RemoteAddr,
	)
}

// HealthCheck handles GET /health requests for liveness/readiness probes.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.logger.Debug("Health check request received",
		"method", r.Method,
		"remote_addr", r.RemoteAddr,
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if fl, ok := w.(http.Flusher); ok {
		fl.Flush()
	}

	encoder := json.NewEncoder(w)
	if err := encoder.Encode(map[string]string{"status": "ok"}); err != nil {
		h.logger.Error("failed to encode health check response",
			"error", err,
			"remote_addr", r.RemoteAddr,
		)
	}
}
