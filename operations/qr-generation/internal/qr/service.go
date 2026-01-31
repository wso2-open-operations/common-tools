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

// Package qr provides QR code generation functionality.
package qr

import (
	"fmt"
	"log/slog"
	"unicode/utf8"

	"github.com/skip2/go-qrcode"
)

type Service interface {
	Generate(data []byte, size int) ([]byte, error)
}

type service struct {
	logger  *slog.Logger
	minSize int
	maxSize int
}

// NewService creates a new QR code generation service instance.
func NewService(logger *slog.Logger, minSize, maxSize int) Service {
	return &service{
		logger:  logger,
		minSize: minSize,
		maxSize: maxSize,
	}
}

// Generate creates a QR code PNG image from the provided data with Medium error recovery (15%).
func (s *service) Generate(data []byte, size int) ([]byte, error) {
	s.logger.Debug("Starting QR code generation",
		"data_length", len(data),
		"size", size,
	)

	if len(data) == 0 {
		s.logger.Warn("QR code generation failed: empty data provided")
		return nil, fmt.Errorf("data cannot be empty")
	}

	if size < s.minSize || size > s.maxSize {
		s.logger.Warn("QR code generation failed: invalid size",
			"size", size,
			"min", s.minSize,
			"max", s.maxSize,
		)
		return nil, fmt.Errorf("invalid size: must be between %d and %d", s.minSize, s.maxSize)
	}

	s.logger.Debug("Encoding QR code",
		"recovery_level", "Medium",
		"data_length", len(data),
	)

	// Note: The skip2/go-qrcode library requires string input.
	// Converting []byte to string creates a copy, but this is unavoidable with current library.
	// Consider checking if newer versions support []byte directly to avoid allocation.
	png, err := qrcode.Encode(string(data), qrcode.Medium, size)
	if err != nil {
		s.logger.Error("Failed to encode QR code",
			"error", err,
			"data_length", len(data),
			"size", size,
		)
		return nil, fmt.Errorf("failed to encode QR code: %w", err)
	}

	s.logger.Debug("QR code generated successfully",
		"output_size_bytes", len(png),
		"image_dimensions", fmt.Sprintf("%dx%d", size, size),
	)

	return png, nil
}

// truncateString truncates a string to maxLen for safe logging with proper UTF-8 handling.
func truncateString(s string, maxLen int) string {
	if utf8.RuneCountInString(s) <= maxLen {
		return s
	}
	runes := []rune(s)
	// Safe slice with bounds check
	end := min(maxLen, len(runes))
	return string(runes[:end]) + "..."
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
