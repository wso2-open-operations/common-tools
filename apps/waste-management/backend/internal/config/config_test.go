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

package config

import (
	"strings"
	"testing"
	"time"
)

func setRequiredEnv(t *testing.T) {
	t.Helper()
	t.Setenv("PORT", "8080")
	t.Setenv("FRONTEND_ORIGIN", "https://waste-dashboard.example.com")
	t.Setenv("GOOGLE_SHEET_ID", "sheet-123")
	t.Setenv("GOOGLE_SHEET_RANGE", "Sheet1!A2:H")
	t.Setenv("GOOGLE_OAUTH_CLIENT_ID", "client-id")
	t.Setenv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret")
	t.Setenv("GOOGLE_OAUTH_REFRESH_TOKEN", "refresh-token")
	t.Setenv("CACHE_TTL_SECONDS", "300")
}

func TestLoad_MissingRequired(t *testing.T) {
	_, err := Load()
	if err == nil {
		t.Fatal("expected an error when required env vars are unset")
	}
	for _, want := range []string{
		"PORT",
		"FRONTEND_ORIGIN",
		"GOOGLE_SHEET_ID",
		"GOOGLE_SHEET_RANGE",
		"GOOGLE_OAUTH_CLIENT_ID",
		"GOOGLE_OAUTH_CLIENT_SECRET",
		"GOOGLE_OAUTH_REFRESH_TOKEN",
		"CACHE_TTL_SECONDS",
	} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("expected error to mention %s, got: %v", want, err)
		}
	}
}

func TestLoad_Success(t *testing.T) {
	setRequiredEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want 8080", cfg.Port)
	}
	if cfg.CORSAllowedOrigin != "https://waste-dashboard.example.com" {
		t.Errorf("CORSAllowedOrigin = %q, want https://waste-dashboard.example.com", cfg.CORSAllowedOrigin)
	}
	if cfg.CacheTTL != 300*time.Second {
		t.Errorf("CacheTTL = %v, want 300s", cfg.CacheTTL)
	}
	if cfg.Sheets.Range != "Sheet1!A2:H" {
		t.Errorf("Sheets.Range = %q, want Sheet1!A2:H", cfg.Sheets.Range)
	}
	if cfg.Sheets.SpreadsheetID != "sheet-123" {
		t.Errorf("Sheets.SpreadsheetID = %q, want sheet-123", cfg.Sheets.SpreadsheetID)
	}
}

func TestLoad_CustomValues(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("PORT", "9090")
	t.Setenv("FRONTEND_ORIGIN", "https://example.com")
	t.Setenv("CACHE_TTL_SECONDS", "60")
	t.Setenv("GOOGLE_SHEET_RANGE", "Sheet2!A1:G")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Port != "9090" {
		t.Errorf("Port = %q, want 9090", cfg.Port)
	}
	if cfg.CORSAllowedOrigin != "https://example.com" {
		t.Errorf("CORSAllowedOrigin = %q, want https://example.com", cfg.CORSAllowedOrigin)
	}
	if cfg.CacheTTL != 60*time.Second {
		t.Errorf("CacheTTL = %v, want 60s", cfg.CacheTTL)
	}
	if cfg.Sheets.Range != "Sheet2!A1:G" {
		t.Errorf("Sheets.Range = %q, want Sheet2!A1:G", cfg.Sheets.Range)
	}
}

func TestLoad_InvalidCacheTTL(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("CACHE_TTL_SECONDS", "not-a-number")

	if _, err := Load(); err == nil {
		t.Fatal("expected an error for a non-numeric CACHE_TTL_SECONDS")
	}
}
