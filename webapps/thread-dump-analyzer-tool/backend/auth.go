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

package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

// Authenticator validates inbound Bearer JWTs against a cached, auto-refreshing
// JWKS (the IdP's signing keys) plus the expected issuer/audience claims.
type Authenticator struct {
	keySet   jwk.Set
	issuer   string
	audience string
	skew     time.Duration
}

// NewAuthenticator wires a background-refreshing JWKS cache. It fails fast if the
// required config (JWKS URL, issuer) is missing so an unconfigured server never boots.
func NewAuthenticator(ctx context.Context, cfg *Config) (*Authenticator, error) {
	if cfg.JWKSURL == "" || cfg.JWTIssuer == "" {
		return nil, errors.New("auth enabled but unconfigured: set ASGARDEO_BASE_URL (or JWT_JWKS_URL + JWT_ISSUER)")
	}

	cache := jwk.NewCache(ctx)
	if err := cache.Register(cfg.JWKSURL, jwk.WithMinRefreshInterval(15*time.Minute)); err != nil {
		return nil, fmt.Errorf("register JWKS url: %w", err)
	}

	// Best-effort prime so a wrong URL shows up at boot; transient failures are
	// tolerated since the cache keeps retrying in the background.
	primeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if _, err := cache.Refresh(primeCtx, cfg.JWKSURL); err != nil {
		slog.Error("failed to prime JWKS cache; will retry in background", "jwks_url", cfg.JWKSURL, "error", err)
	}

	return &Authenticator{
		keySet:   jwk.NewCachedSet(cache, cfg.JWKSURL),
		issuer:   cfg.JWTIssuer,
		audience: cfg.JWTAudience,
		skew:     60 * time.Second,
	}, nil
}

// RequireAuth wraps a handler, rejecting any request without a valid Bearer JWT.
func (a *Authenticator) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw, err := bearerToken(r)
		if err != nil {
			unauthorized(w, "missing or malformed Authorization header")
			return
		}

		opts := []jwt.ParseOption{
			jwt.WithKeySet(a.keySet),
			jwt.WithValidate(true),
			jwt.WithIssuer(a.issuer),
			jwt.WithAcceptableSkew(a.skew),
		}
		if a.audience != "" {
			opts = append(opts, jwt.WithAudience(a.audience))
		}

		if _, err := jwt.Parse([]byte(raw), opts...); err != nil {
			slog.Warn("rejected request: token validation failed", "error", err, "remote_addr", r.RemoteAddr, "path", r.URL.Path)
			unauthorized(w, "invalid or expired token")
			return
		}

		next.ServeHTTP(w, r)
	}
}

// bearerToken extracts the token from an "Authorization: Bearer <token>" header.
func bearerToken(r *http.Request) (string, error) {
	h := r.Header.Get("Authorization")
	if h == "" {
		return "", errors.New("no Authorization header")
	}
	const prefix = "Bearer "
	if len(h) < len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return "", errors.New("not a Bearer token")
	}
	token := strings.TrimSpace(h[len(prefix):])
	if token == "" {
		return "", errors.New("empty bearer token")
	}
	return token, nil
}

// unauthorized writes a 401 with an RFC 6750 Bearer challenge.
func unauthorized(w http.ResponseWriter, detail string) {
	w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
	http.Error(w, detail, http.StatusUnauthorized)
}
