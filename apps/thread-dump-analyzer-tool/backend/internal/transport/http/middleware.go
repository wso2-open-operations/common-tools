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
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
	"golang.org/x/time/rate"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/config"
)

// IPLimiter applies a per-remote-IP token bucket; idle visitors are evicted by a background janitor.
type IPLimiter struct {
	rps      rate.Limit
	burst    int
	ttl      time.Duration
	mu       sync.Mutex
	visitors map[string]*ipVisitor
}

type ipVisitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func NewIPLimiter(rps float64, burst int, ttl, janitorTick time.Duration) *IPLimiter {
	l := &IPLimiter{
		rps:      rate.Limit(rps),
		burst:    burst,
		ttl:      ttl,
		visitors: make(map[string]*ipVisitor),
	}
	if janitorTick > 0 {
		go l.janitor(janitorTick)
	}
	return l
}

func (l *IPLimiter) Allow(ip string) bool {
	l.mu.Lock()
	v, ok := l.visitors[ip]
	if !ok {
		v = &ipVisitor{limiter: rate.NewLimiter(l.rps, l.burst)}
		l.visitors[ip] = v
	}
	v.lastSeen = time.Now()
	l.mu.Unlock()
	return v.limiter.Allow()
}

func (l *IPLimiter) janitor(tick time.Duration) {
	ticker := time.NewTicker(tick)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-l.ttl)
		l.mu.Lock()
		for ip, v := range l.visitors {
			if v.lastSeen.Before(cutoff) {
				delete(l.visitors, ip)
			}
		}
		l.mu.Unlock()
	}
}

// limitByIP wraps a handler so each remote IP gets its own token bucket; 429 on refuse.
// Trusts r.RemoteAddr (OS-reported TCP peer) — does not honor X-Forwarded-For to avoid client spoofing.
func (l *IPLimiter) limitByIP(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			host = r.RemoteAddr
		}
		if !l.Allow(host) {
			http.Error(w, "Too many requests, please slow down", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	}
}

// Authenticator validates inbound Bearer JWTs against a cached, auto-refreshing JWKS plus expected issuer/audience claims.
type Authenticator struct {
	keySet   jwk.Set
	issuer   string
	audience string
	skew     time.Duration
}

// NewAuthenticator wires a background-refreshing JWKS cache, failing fast on missing config so an unconfigured server never boots.
func NewAuthenticator(ctx context.Context, cfg *config.Config) (*Authenticator, error) {
	if cfg.JWKSURL == "" || cfg.JWTIssuer == "" {
		return nil, errors.New("auth enabled but unconfigured: set ASGARDEO_BASE_URL (or JWT_JWKS_URL + JWT_ISSUER)")
	}

	cache := jwk.NewCache(ctx)
	if err := cache.Register(cfg.JWKSURL, jwk.WithMinRefreshInterval(15*time.Minute)); err != nil {
		return nil, fmt.Errorf("register JWKS url: %w", err)
	}

	// Best-effort prime so a wrong URL shows up at boot; transient failures are tolerated since the cache retries in background.
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
		raw, err := extractToken(r)
		if err != nil {
			unauthorized(w, "missing or malformed credentials")
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

		tok, err := jwt.Parse([]byte(raw), opts...)
		if err != nil {
			slog.Warn("rejected request: token validation failed", "error", err, "remote_addr", r.RemoteAddr, "path", r.URL.Path)
			unauthorized(w, "invalid or expired token")
			return
		}

		// Carry the subject so handlers can bind a job to its creator and reject cross-user reads.
		ctx := context.WithValue(r.Context(), subjectContextKey, tok.Subject())
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// contextKey is unexported so only this package can write the authenticated subject into a request context.
type contextKey string

const subjectContextKey contextKey = "auth.subject"

// subjectFromContext returns the authenticated "sub" claim, or "" when auth is disabled or no token was validated.
func subjectFromContext(ctx context.Context) string {
	s, _ := ctx.Value(subjectContextKey).(string)
	return s
}

// extractToken prefers Choreo's "x-jwt-assertion" header, falls back to "Authorization: Bearer".
func extractToken(r *http.Request) (string, error) {
	if assertion := strings.TrimSpace(r.Header.Get("x-jwt-assertion")); assertion != "" {
		return assertion, nil
	}
	h := r.Header.Get("Authorization")
	if h == "" {
		return "", errors.New("no Authorization or x-jwt-assertion header")
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
