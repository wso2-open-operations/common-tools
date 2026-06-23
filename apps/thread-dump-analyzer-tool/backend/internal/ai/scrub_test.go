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

package ai

import (
	"strings"
	"testing"

	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/analyzer"
	"github.com/wso2-open-operations/common-tools/apps/thread-dump-analyzer-tool/backend/internal/parser"
)

func TestScrub_RedactsSecretsAndPII(t *testing.T) {
	cases := []struct {
		name   string
		in     string
		want   string
		secret string // substring that must NOT survive
	}{
		{"bearer", "Authorization: Bearer abc123.def-456", "Authorization: [REDACTED_AUTH]", "abc123.def-456"},
		{"basic", "header Basic dXNlcjpwYXNz end", "header [REDACTED_AUTH] end", "dXNlcjpwYXNz"},
		{"jwt", "tok eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4", "tok [REDACTED_JWT]", "eyJzdWIiOiIxMjM0In0"},
		{"password_kv", "password=hunter2", "password=[REDACTED]", "hunter2"},
		{"token_kv", "access_token: s3cr3tValue", "access_token: [REDACTED]", "s3cr3tValue"},
		{"apikey_kv", "api_key=AKIA1234567890", "api_key=[REDACTED]", "AKIA1234567890"},
		{"email", "user john.doe@example.com here", "user [REDACTED_EMAIL] here", "john.doe@example.com"},
		{"uuid", "id 550e8400-e29b-41d4-a716-446655440000 done", "id [REDACTED_UUID] done", "550e8400-e29b-41d4-a716-446655440000"},
		{"ipv4", "RMI TCP Connection-10.20.30.40", "RMI TCP Connection-[REDACTED_IP]", "10.20.30.40"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := scrub(c.in)
			if got != c.want {
				t.Fatalf("scrub(%q) = %q, want %q", c.in, got, c.want)
			}
			if strings.Contains(got, c.secret) {
				t.Fatalf("secret %q survived scrub: %q", c.secret, got)
			}
		})
	}
}

// Stack frames and pool classification must survive untouched so the AI keeps its diagnostic signal.
func TestScrub_PreservesDiagnosticText(t *testing.T) {
	for _, in := range []string{
		"at org.apache.tomcat.jdbc.pool.ConnectionPool.borrowConnection(ConnectionPool.java:780)",
		"http-nio-8080-exec-1",
		"at com.app.TokenService.validate(TokenService.java:42)", // "token" without a key=value must not trip
	} {
		if got := scrub(in); got != in {
			t.Fatalf("scrub mutated diagnostic text: scrub(%q) = %q", in, got)
		}
	}
}

// The scrub must apply through the actual prompt path: name, issues, and stack frames.
func TestBuildPrompt_ScrubsSensitiveFields(t *testing.T) {
	threads := []analyzer.AnalyzedThread{
		mkThread("worker john.doe@acme.com", parser.RiskCritical, "PoolX",
			[]string{"stuck with password=hunter2"},
			[]string{"at Auth.check(Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.zzz)"}),
	}
	out := buildPrompt(threads, true)

	for _, leaked := range []string{"john.doe@acme.com", "hunter2", "eyJzdWIiOiJ4In0", "Bearer eyJ"} {
		if strings.Contains(out, leaked) {
			t.Fatalf("sensitive value %q reached the prompt:\n%s", leaked, out)
		}
	}
	if !strings.Contains(out, "[REDACTED_EMAIL]") || !strings.Contains(out, "[REDACTED]") {
		t.Fatalf("expected redaction placeholders in prompt:\n%s", out)
	}
}
