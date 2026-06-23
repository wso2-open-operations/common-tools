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
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds runtime-tunable settings from environment variables.
// Every field has a sensible default; the server runs without explicit configuration.
type Config struct {
	Port              string
	PublicURL         string
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration

	RulesPath       string
	ThreadPoolsPath string

	CORSAllowedOrigins []string
	CORSAllowedMethods []string
	CORSAllowedHeaders []string
	CORSDebug          bool

	MaxUploadBytes            int64
	MaxDecompressedBytes      int64
	MaxTotalDecompressedBytes int64
	MaxFilesPerRequest        int
	JobTTL                    time.Duration
	JobStoreMaxSize           int
	JobJanitorTick            time.Duration
	JobTimeout                time.Duration

	MaxConcurrentJobs    int
	RateLimitRPS         float64
	RateLimitBurst       int
	RateLimitVisitorTTL  time.Duration
	RateLimitJanitorTick time.Duration

	// When AuthEnabled, /analyze/jobs requires a Bearer JWT validated against JWKSURL with matching JWTIssuer (and JWTAudience if set).
	AuthEnabled bool
	JWKSURL     string
	JWTIssuer   string
	JWTAudience string

	// AIInsightsEnabled gates the outbound Anthropic call; false keeps all thread-dump data in-process even when a key is configured.
	AIInsightsEnabled bool
}

// LoadConfig reads env vars, falling back to defaults when unset or malformed.
// Malformed values produce a slog.Warn so misconfiguration surfaces in logs.
func LoadConfig() *Config {
	port := getEnv("PORT", "8080")

	// Derive JWKS + issuer from the Asgardeo tenant base URL; explicit overrides win.
	asgardeoBaseURL := strings.TrimRight(getEnv("ASGARDEO_BASE_URL", ""), "/")
	jwksURL := getEnv("JWT_JWKS_URL", "")
	jwtIssuer := getEnv("JWT_ISSUER", "")
	if asgardeoBaseURL != "" {
		if jwksURL == "" {
			jwksURL = asgardeoBaseURL + "/oauth2/jwks"
		}
		if jwtIssuer == "" {
			jwtIssuer = asgardeoBaseURL + "/oauth2/token"
		}
	}

	// MaxDecompressedBytes defaults to twice the wire cap so raising MAX_UPLOAD_BYTES scales the inflate ceiling with it.
	uploadBytes := getEnvBytes("MAX_UPLOAD_BYTES", 100<<20)
	// The request total defaults to twice the per-file cap so many parts can't sum into an OOM even when each clears its own ceiling.
	decompressedBytes := getEnvBytes("MAX_DECOMPRESSED_BYTES", uploadBytes*2)

	return &Config{
		Port:              port,
		PublicURL:         strings.TrimRight(getEnv("PUBLIC_URL", "http://localhost:"+port), "/"),
		ReadHeaderTimeout: getEnvDuration("READ_HEADER_TIMEOUT", 30*time.Second),
		// Read/Write timeouts bound the full upload window; 60s was too tight for ~50MB on real uplinks.
		ReadTimeout:  getEnvDuration("READ_TIMEOUT", 10*time.Minute),
		WriteTimeout: getEnvDuration("WRITE_TIMEOUT", 10*time.Minute),
		IdleTimeout:  getEnvDuration("IDLE_TIMEOUT", 5*time.Minute),

		RulesPath:       getEnv("RULES_PATH", "./internal/rules/rules.grl"),
		ThreadPoolsPath: getEnv("THREAD_POOLS_PATH", "./config/thread_pools.yaml"),

		CORSAllowedOrigins: getEnvList("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173"}),
		CORSAllowedMethods: getEnvList("CORS_ALLOWED_METHODS", []string{"GET", "POST", "OPTIONS"}),
		CORSAllowedHeaders: getEnvList("CORS_ALLOWED_HEADERS", []string{"Accept", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization"}),
		CORSDebug:          strings.EqualFold(strings.TrimSpace(os.Getenv("CORS_DEBUG")), "true"),

		MaxUploadBytes:            uploadBytes,
		MaxDecompressedBytes:      decompressedBytes,
		MaxTotalDecompressedBytes: getEnvBytes("MAX_TOTAL_DECOMPRESSED_BYTES", decompressedBytes*2),
		MaxFilesPerRequest:        getEnvInt("MAX_FILES_PER_REQUEST", 200),
		JobTTL:                    getEnvDuration("JOB_TTL", 1*time.Hour),
		JobStoreMaxSize:           getEnvInt("JOB_STORE_MAX_SIZE", 200),
		JobJanitorTick:            getEnvDuration("JOB_JANITOR_TICK", 1*time.Minute),
		JobTimeout:                getEnvDuration("JOB_TIMEOUT", 2*time.Minute),

		MaxConcurrentJobs:    getEnvInt("MAX_CONCURRENT_JOBS", 10),
		RateLimitRPS:         getEnvFloat("RATE_LIMIT_RPS", 0.5),
		RateLimitBurst:       getEnvInt("RATE_LIMIT_BURST", 5),
		RateLimitVisitorTTL:  getEnvDuration("RATE_LIMIT_VISITOR_TTL", 1*time.Hour),
		RateLimitJanitorTick: getEnvDuration("RATE_LIMIT_JANITOR_TICK", 5*time.Minute),

		AuthEnabled: getEnvBool("AUTH_ENABLED", true),
		JWKSURL:     jwksURL,
		JWTIssuer:   jwtIssuer,
		JWTAudience: getEnv("JWT_AUDIENCE", ""),

		AIInsightsEnabled: getEnvBool("AI_INSIGHTS_ENABLED", true),
	}
}

// Validate enforces cross-field invariants that must hold before the server boots.
// It returns an error rather than logging so the caller can fail fast.
func (c *Config) Validate() error {
	// Without an audience check, a token minted by the same IdP for another client is accepted here.
	if c.AuthEnabled && c.JWTAudience == "" {
		return errors.New("AUTH_ENABLED=true requires JWT_AUDIENCE (the app's client ID) so tokens minted for other Asgardeo apps are rejected; set JWT_AUDIENCE, or set AUTH_ENABLED=false for local dev")
	}
	return nil
}

// getEnvBool parses a boolean (true/false/1/0/yes/no/on/off, case-insensitive); warns and falls back on malformed input.
func getEnvBool(key string, def bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	switch strings.ToLower(raw) {
	case "1", "t", "true", "yes", "y", "on":
		return true
	case "0", "f", "false", "no", "n", "off":
		return false
	default:
		slog.Warn("invalid boolean, using default", "key", key, "value", raw, "default", def)
		return def
	}
}

// getEnvFloat parses a float64; warns and falls back on malformed input.
func getEnvFloat(key string, def float64) float64 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	f, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		slog.Warn("invalid float, using default", "key", key, "value", raw, "default", def)
		return def
	}
	return f
}

// getEnvInt parses a base-10 integer; warns and falls back on malformed input.
func getEnvInt(key string, def int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		slog.Warn("invalid integer, using default", "key", key, "value", raw, "default", def)
		return def
	}
	return n
}

// getEnvBytes accepts a byte count or size with unit suffix (B/KB/MB/GB, IEC).
// 1 KB = 1024 B. Warns and falls back on malformed input.
func getEnvBytes(key string, def int64) int64 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	n, err := parseBytes(raw)
	if err != nil {
		slog.Warn("invalid byte size, using default", "key", key, "value", raw, "default", def, "error", err)
		return def
	}
	return n
}

func parseBytes(s string) (int64, error) {
	s = strings.TrimSpace(s)
	i := 0
	for i < len(s) && s[i] >= '0' && s[i] <= '9' {
		i++
	}
	if i == 0 {
		return 0, fmt.Errorf("no leading digits in %q", s)
	}
	n, err := strconv.ParseInt(s[:i], 10, 64)
	if err != nil {
		return 0, err
	}
	switch strings.ToUpper(strings.TrimSpace(s[i:])) {
	case "", "B":
		return n, nil
	case "K", "KB", "KIB":
		return n << 10, nil
	case "M", "MB", "MIB":
		return n << 20, nil
	case "G", "GB", "GIB":
		return n << 30, nil
	default:
		return 0, fmt.Errorf("unknown unit %q", s[i:])
	}
}

func getEnv(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

// getEnvDuration parses Go duration strings (e.g. "5s", "1m", "500ms"); logs a warning and returns the default on parse failure.
func getEnvDuration(key string, def time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	d, err := time.ParseDuration(raw)
	if err != nil {
		slog.Warn("invalid duration, using default", "key", key, "value", raw, "default", def)
		return def
	}
	return d
}

// getEnvList parses a comma-separated list; empty entries are dropped and an empty result returns the default.
func getEnvList(key string, def []string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return def
	}
	return out
}
