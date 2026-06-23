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

import "regexp"

// Secrets and PII scrubbed from thread text before it leaves for the AI API; specific patterns run before generic ones.
var (
	reAuth     = regexp.MustCompile(`(?i)\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]+`)
	reSecretKV = regexp.MustCompile(`(?i)\b([\w-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential|authorization)[\w-]*)(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;"'\[\]]+)`)
	reJWT      = regexp.MustCompile(`eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`)
	reEmail    = regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`)
	reUUID     = regexp.MustCompile(`(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`)
	reIPv4     = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
)

// scrub redacts secrets and PII (auth, JWTs, key=value secrets, emails, UUIDs, IPs) so customer data is not sent to the AI API.
func scrub(s string) string {
	s = reAuth.ReplaceAllString(s, "[REDACTED_AUTH]")
	s = reSecretKV.ReplaceAllString(s, "${1}${2}[REDACTED]")
	s = reJWT.ReplaceAllString(s, "[REDACTED_JWT]")
	s = reEmail.ReplaceAllString(s, "[REDACTED_EMAIL]")
	s = reUUID.ReplaceAllString(s, "[REDACTED_UUID]")
	s = reIPv4.ReplaceAllString(s, "[REDACTED_IP]")
	return s
}

// scrubAll applies scrub to each element, returning a new slice.
func scrubAll(ss []string) []string {
	out := make([]string, len(ss))
	for i, s := range ss {
		out[i] = scrub(s)
	}
	return out
}
