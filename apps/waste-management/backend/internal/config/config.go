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

// Package config loads the waste-management backend's process configuration
// from the environment. It owns all env var reads; other packages take a
// plain Config/sheets.Config value instead of reading the environment
// themselves.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/wso2-open-operations/common-tools/apps/waste-management/backend/internal/sheets"
)

// Config is the backend process configuration.
type Config struct {
	Port              string
	CORSAllowedOrigin string
	CacheTTL          time.Duration
	Sheets            sheets.Config
}

// Load reads every variable listed in .env.example and returns an error
// listing all that are missing or invalid. None has a local default: a
// value silently substituted for an unset variable (e.g. FRONTEND_ORIGIN
// falling back to an open "*" CORS policy) is exactly the kind of
// misconfiguration that should fail loudly instead of shipping quietly.
func Load() (Config, error) {
	var missing []string
	require := func(key string) string {
		v := strings.TrimSpace(os.Getenv(key))
		if v == "" {
			missing = append(missing, key)
		}
		return v
	}

	port := require("PORT")
	corsOrigin := require("FRONTEND_ORIGIN")
	sheetID := require("GOOGLE_SHEET_ID")
	sheetRange := require("GOOGLE_SHEET_RANGE")
	clientID := require("GOOGLE_OAUTH_CLIENT_ID")
	clientSecret := require("GOOGLE_OAUTH_CLIENT_SECRET")
	refreshToken := require("GOOGLE_OAUTH_REFRESH_TOKEN")
	cacheTTLRaw := require("CACHE_TTL_SECONDS")

	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required configuration: %s", strings.Join(missing, ", "))
	}

	cacheTTL, err := parseSeconds("CACHE_TTL_SECONDS", cacheTTLRaw)
	if err != nil {
		return Config{}, err
	}

	return Config{
		Port:              port,
		CORSAllowedOrigin: corsOrigin,
		CacheTTL:          cacheTTL,
		Sheets: sheets.Config{
			SpreadsheetID: sheetID,
			Range:         sheetRange,
			ClientID:      clientID,
			ClientSecret:  clientSecret,
			RefreshToken:  refreshToken,
		},
	}, nil
}

func parseSeconds(key, raw string) (time.Duration, error) {
	seconds, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s: %w", key, err)
	}
	if seconds < 0 {
		return 0, fmt.Errorf("%s must be non-negative", key)
	}
	return time.Duration(seconds) * time.Second, nil
}
