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
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/config"
)

const (
	testIssuer   = "https://issuer.example.com/oauth2/token"
	testAudience = "test-client-id"
	testKID      = "test-key-1"
)

// newSigningKey builds an RSA private JWK (with kid + alg) for signing test tokens.
func newSigningKey(t *testing.T) jwk.Key {
	t.Helper()
	raw, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}
	priv, err := jwk.FromRaw(raw)
	if err != nil {
		t.Fatalf("priv jwk: %v", err)
	}
	priv.Set(jwk.KeyIDKey, testKID)
	priv.Set(jwk.AlgorithmKey, jwa.RS256)
	return priv
}

// publicJWKS serves the JWK set for a signing key and returns the server URL.
func publicJWKS(t *testing.T, priv jwk.Key) string {
	t.Helper()
	pub, err := priv.PublicKey()
	if err != nil {
		t.Fatalf("derive public key: %v", err)
	}
	pub.Set(jwk.KeyUsageKey, "sig")

	set := jwk.NewSet()
	if err := set.AddKey(pub); err != nil {
		t.Fatalf("add key: %v", err)
	}
	body, err := json.Marshal(set)
	if err != nil {
		t.Fatalf("marshal jwks: %v", err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

// newTestAuth wires an Authenticator against a live JWKS server backed by priv.
func newTestAuth(t *testing.T, priv jwk.Key, audience string) *Authenticator {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	authn, err := NewAuthenticator(ctx, &config.Config{
		JWKSURL:     publicJWKS(t, priv),
		JWTIssuer:   testIssuer,
		JWTAudience: audience,
	})
	if err != nil {
		t.Fatalf("NewAuthenticator: %v", err)
	}
	return authn
}

// validToken returns a freshly-built, currently-valid token for the test issuer/audience.
func validToken(t *testing.T) jwt.Token {
	t.Helper()
	tok, err := jwt.NewBuilder().
		Issuer(testIssuer).
		Audience([]string{testAudience}).
		Subject("user-123").
		IssuedAt(time.Now()).
		Expiration(time.Now().Add(5 * time.Minute)).
		Build()
	if err != nil {
		t.Fatalf("build token: %v", err)
	}
	return tok
}

func sign(t *testing.T, priv jwk.Key, tok jwt.Token) string {
	t.Helper()
	signed, err := jwt.Sign(tok, jwt.WithKey(jwa.RS256, priv))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return string(signed)
}

// callAuth runs a request through RequireAuth, returning the status and whether the handler ran.
func callAuth(authn *Authenticator, authzHeader string) (int, bool) {
	called := false
	h := authn.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/analyze/jobs/abc", nil)
	if authzHeader != "" {
		r.Header.Set("Authorization", authzHeader)
	}
	h(w, r)
	return w.Code, called
}

func TestRequireAuth_ValidTokenPasses(t *testing.T) {
	priv := newSigningKey(t)
	authn := newTestAuth(t, priv, testAudience)

	code, called := callAuth(authn, "Bearer "+sign(t, priv, validToken(t)))
	if code != http.StatusOK || !called {
		t.Fatalf("valid token: code=%d called=%v, want 200/true", code, called)
	}
}

func TestRequireAuth_BearerSchemeIsCaseInsensitive(t *testing.T) {
	priv := newSigningKey(t)
	authn := newTestAuth(t, priv, testAudience)

	code, called := callAuth(authn, "bearer "+sign(t, priv, validToken(t)))
	if code != http.StatusOK || !called {
		t.Fatalf("lowercase scheme: code=%d called=%v, want 200/true", code, called)
	}
}

func TestRequireAuth_RejectsBadRequests(t *testing.T) {
	priv := newSigningKey(t)
	authn := newTestAuth(t, priv, testAudience)
	otherKey := newSigningKey(t) // valid kid, but not the JWKS key: signature mismatch

	expired := validToken(t)
	expired.Set(jwt.ExpirationKey, time.Now().Add(-10*time.Minute))
	expired.Set(jwt.IssuedAtKey, time.Now().Add(-20*time.Minute))

	wrongIss := validToken(t)
	wrongIss.Set(jwt.IssuerKey, "https://evil.example.com/oauth2/token")

	wrongAud := validToken(t)
	wrongAud.Set(jwt.AudienceKey, []string{"some-other-app"})

	notYet := validToken(t)
	notYet.Set(jwt.NotBeforeKey, time.Now().Add(10*time.Minute))

	cases := []struct {
		name   string
		header string
	}{
		{"no header", ""},
		{"wrong scheme", "Basic " + sign(t, priv, validToken(t))},
		{"empty bearer", "Bearer "},
		{"not a jwt", "Bearer not.a.jwt"},
		{"signed by unknown key", "Bearer " + sign(t, otherKey, validToken(t))},
		{"expired", "Bearer " + sign(t, priv, expired)},
		{"wrong issuer", "Bearer " + sign(t, priv, wrongIss)},
		{"wrong audience", "Bearer " + sign(t, priv, wrongAud)},
		{"not yet valid", "Bearer " + sign(t, priv, notYet)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, called := callAuth(authn, tc.header)
			if code != http.StatusUnauthorized {
				t.Fatalf("code=%d, want 401", code)
			}
			if called {
				t.Fatal("protected handler ran despite rejected token")
			}
		})
	}
}

func TestRequireAuth_AudienceSkippedWhenUnset(t *testing.T) {
	priv := newSigningKey(t)
	authn := newTestAuth(t, priv, "") // no audience configured: aud not enforced

	tok := validToken(t)
	tok.Set(jwt.AudienceKey, []string{"unrelated-app"})

	code, called := callAuth(authn, "Bearer "+sign(t, priv, tok))
	if code != http.StatusOK || !called {
		t.Fatalf("audience-unset: code=%d called=%v, want 200/true", code, called)
	}
}

// A valid token's subject must reach the request context so handlers can bind jobs to their creator.
func TestRequireAuth_PropagatesSubject(t *testing.T) {
	priv := newSigningKey(t)
	authn := newTestAuth(t, priv, testAudience)

	var gotSub string
	h := authn.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		gotSub = subjectFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	})
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/analyze/jobs/abc", nil)
	r.Header.Set("Authorization", "Bearer "+sign(t, priv, validToken(t)))
	h(w, r)

	if gotSub != "user-123" {
		t.Fatalf("subject in context = %q, want %q", gotSub, "user-123")
	}
}

func TestRequireAuth_Sets401Challenge(t *testing.T) {
	priv := newSigningKey(t)
	authn := newTestAuth(t, priv, testAudience)

	h := authn.RequireAuth(func(w http.ResponseWriter, r *http.Request) {})
	w := httptest.NewRecorder()
	h(w, httptest.NewRequest(http.MethodGet, "/analyze/jobs/x", nil))

	if got := w.Header().Get("WWW-Authenticate"); got == "" {
		t.Fatal("401 response missing WWW-Authenticate challenge header")
	}
}

func TestNewAuthenticator_FailsFastWhenUnconfigured(t *testing.T) {
	cases := []struct {
		name string
		cfg  *config.Config
	}{
		{"missing both", &config.Config{}},
		{"missing issuer", &config.Config{JWKSURL: "https://x/jwks"}},
		{"missing jwks", &config.Config{JWTIssuer: testIssuer}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := NewAuthenticator(context.Background(), tc.cfg); err == nil {
				t.Fatal("expected error for unconfigured authenticator, got nil")
			}
		})
	}
}

// IPLimiter must allow up to burst, then refuse until the bucket refills.
func TestIPLimiter_BurstThenRefuse(t *testing.T) {
	l := NewIPLimiter(0.0001, 3, time.Hour, 0)

	for i := 0; i < 3; i++ {
		if !l.Allow("1.2.3.4") {
			t.Fatalf("allow #%d should succeed within burst=3", i+1)
		}
	}
	if l.Allow("1.2.3.4") {
		t.Fatal("4th request from same IP should be refused")
	}
	if !l.Allow("5.6.7.8") {
		t.Fatal("a different IP should have its own bucket")
	}
}

func TestIPLimiter_MiddlewareReturns429(t *testing.T) {
	l := NewIPLimiter(0.0001, 1, time.Hour, 0)

	called := 0
	handler := l.limitByIP(func(w http.ResponseWriter, r *http.Request) {
		called++
		w.WriteHeader(http.StatusOK)
	})

	w1 := httptest.NewRecorder()
	r1 := httptest.NewRequest(http.MethodPost, "/", nil)
	r1.RemoteAddr = "1.2.3.4:5000"
	handler(w1, r1)
	if w1.Code != http.StatusOK {
		t.Fatalf("first request code=%d, want 200", w1.Code)
	}

	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodPost, "/", nil)
	r2.RemoteAddr = "1.2.3.4:5001"
	handler(w2, r2)
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request code=%d, want 429", w2.Code)
	}
	if called != 1 {
		t.Fatalf("inner handler called %d times, want 1", called)
	}
}

func TestIPLimiter_JanitorEvictsIdleVisitors(t *testing.T) {
	l := NewIPLimiter(1, 1, 20*time.Millisecond, 10*time.Millisecond)
	l.Allow("9.9.9.9")
	l.mu.Lock()
	if _, ok := l.visitors["9.9.9.9"]; !ok {
		l.mu.Unlock()
		t.Fatal("visitor missing right after Allow")
	}
	l.mu.Unlock()

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		l.mu.Lock()
		_, present := l.visitors["9.9.9.9"]
		l.mu.Unlock()
		if !present {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("janitor did not evict idle visitor")
}

// limitByIP must key the bucket on the port-stripped RemoteAddr and ignore X-Forwarded-For.
func TestLimitByIP_BucketKey(t *testing.T) {
	// burst 1 so the second request sharing a bucket is refused within the test window.
	l := NewIPLimiter(1, 1, time.Hour, 0)
	h := l.limitByIP(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	send := func(remoteAddr, xff string) int {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.RemoteAddr = remoteAddr
		if xff != "" {
			r.Header.Set("X-Forwarded-For", xff)
		}
		w := httptest.NewRecorder()
		h(w, r)
		return w.Code
	}

	// Same host on different ports shares one bucket, so the burst is spent across them.
	if code := send("10.0.0.5:1111", ""); code != http.StatusOK {
		t.Fatalf("first request from host: got %d, want 200", code)
	}
	if code := send("10.0.0.5:2222", ""); code != http.StatusTooManyRequests {
		t.Errorf("same host different port: got %d, want 429 (port not stripped from bucket key)", code)
	}

	// A spoofed X-Forwarded-For must not earn a fresh bucket; only RemoteAddr is trusted.
	if code := send("10.0.0.5:3333", "1.2.3.4"); code != http.StatusTooManyRequests {
		t.Errorf("spoofed X-Forwarded-For: got %d, want 429 (header wrongly honored)", code)
	}

	// A genuinely different host gets its own bucket, proving the 429s above are bucket-scoped.
	if code := send("10.0.0.9:4444", ""); code != http.StatusOK {
		t.Errorf("distinct host: got %d, want 200 (limiter not per-IP)", code)
	}
}
