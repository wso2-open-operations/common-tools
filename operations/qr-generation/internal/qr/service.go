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

package qr

import (
	"fmt"

	"github.com/skip2/go-qrcode"
)

// Service defines the business logic for QR codes.
type Service interface {
	Generate(data []byte, size int) ([]byte, error)
}

// service implements the Service interface.
type service struct{}

// NewService creates a new instance of the QR service.
func NewService() Service {
	return &service{}
}

// Generate creates a PNG QR code for the given data and size.
func (s *service) Generate(data []byte, size int) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("data cannot be empty")
	}
	if size <= 0 {
		return nil, fmt.Errorf("invalid size: must be > 0")
	}
	if size > 4096 {
		return nil, fmt.Errorf("invalid size: must be <= 4096")
	}

	// Generate the QR code
	// qrcode.Medium is the error recovery level
	png, err := qrcode.Encode(string(data), qrcode.Medium, size)
	if err != nil {
		return nil, fmt.Errorf("failed to encode QR code: %w", err)
	}

	return png, nil
}
