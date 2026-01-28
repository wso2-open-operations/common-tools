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

package http

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/wso2-open-operations/common-tools/operations/qr-generation/internal/qr"
)

type Handler struct {
	svc         qr.Service
	logger      *slog.Logger
	maxBodySize int64
}

func NewHandler(svc qr.Service, logger *slog.Logger, maxBodySize int64) *Handler {
	return &Handler{
		svc:         svc,
		logger:      logger,
		maxBodySize: maxBodySize,
	}
}

func (h *Handler) Generate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, h.maxBodySize)

	body, err := io.ReadAll(r.Body)
	if err != nil {
		h.logger.Error("failed to read request body", "error", err)
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			http.Error(w, "Request body too large", http.StatusRequestEntityTooLarge)
			return
		}
		http.Error(w, "Failed to read request body", http.StatusInternalServerError)
		return
	}

	if len(body) == 0 {
		http.Error(w, "Request body is empty", http.StatusBadRequest)
		return
	}

	const maxSize = 2048
	size := 256
	sizeStr := r.URL.Query().Get("size")
	if sizeStr != "" {
		parsedSize, err := strconv.Atoi(sizeStr)
		if err != nil || parsedSize <= 0 || parsedSize > maxSize {
			http.Error(w, "Invalid size parameter: must be between 1 and 2048", http.StatusBadRequest)
			return
		}
		size = parsedSize
	}

	png, err := h.svc.Generate(body, size)
	if err != nil {
		h.logger.Error("failed to generate QR code", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(png); err != nil {
		h.logger.Error("failed to write response", "error", err)
		return
	}
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
		h.logger.Error("failed to encode health check response", "error", err)
	}
}
