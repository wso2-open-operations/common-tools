#!/usr/bin/env bash
# Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
#
# WSO2 LLC. licenses this file to you under the Apache License,
# Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

# Software Composition Analysis for thread-dump-analyzer-tool, self-contained in the app.
# Gating mirrors the former root workflow: pnpm audit high+ blocks, govulncheck and trivy report-only.

set -uo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$APP_ROOT/backend"
FRONTEND_DIR="$APP_ROOT/frontend"

fail=0

usage() {
  cat <<'EOF'
Usage: scripts/sca.sh [target]

Targets:
  all        Run every scan (default)
  backend    govulncheck on the Go backend (report-only)
  frontend   pnpm audit on the frontend (gates on high+)
  trivy      Trivy filesystem + Dockerfile scan (report-only)
EOF
}

run_govulncheck() {
  echo "==> govulncheck (backend)"
  if ! command -v go >/dev/null 2>&1; then
    echo "    SKIP: go not installed"
    return 0
  fi
  local bin
  if command -v govulncheck >/dev/null 2>&1; then
    bin=govulncheck
  elif [ -x "$(go env GOPATH)/bin/govulncheck" ]; then
    bin="$(go env GOPATH)/bin/govulncheck"
  else
    echo "    installing govulncheck..."
    if ! go install golang.org/x/vuln/cmd/govulncheck@latest; then
      echo "    SKIP: govulncheck install failed (SCA signal incomplete)"
      return 0
    fi
    bin="$(go env GOPATH)/bin/govulncheck"
    if [ ! -x "$bin" ]; then
      echo "    SKIP: govulncheck not found at $bin after install (SCA signal incomplete)"
      return 0
    fi
  fi
  # Reachability-aware: only flags vulns in code paths actually called.
  ( cd "$BACKEND_DIR" && "$bin" ./... )
  local rc=$?
  # Exit 3 = vulnerabilities found (report-only); any other non-zero is a scanner failure, not a clean result.
  case "$rc" in
    0) ;;
    3) echo "    findings reported (non-blocking)" ;;
    *) echo "    WARN: govulncheck failed to run (exit $rc); SCA signal incomplete" ;;
  esac
}

run_pnpm_audit() {
  echo "==> pnpm audit (frontend)"
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "    SKIP: pnpm not installed"
    return 0
  fi
  # Full report first so moderate/low findings stay visible.
  ( cd "$FRONTEND_DIR" && pnpm audit ) || true
  # Gate on high+; the known high backlog was cleared via pnpm.overrides.
  if ! ( cd "$FRONTEND_DIR" && pnpm audit --audit-level=high ); then
    echo "    FAIL: high or critical advisories present"
    fail=1
  fi
}

run_trivy() {
  echo "==> trivy (filesystem + dockerfiles)"
  local args=(fs --scanners vuln,misconfig,secret --severity CRITICAL,HIGH --ignore-unfixed --format table)
  if command -v trivy >/dev/null 2>&1; then
    trivy "${args[@]}" "$APP_ROOT" || true
  elif command -v docker >/dev/null 2>&1; then
    echo "    trivy not on PATH; using aquasec/trivy image"
    docker run --rm -v "$APP_ROOT:/scan:ro" aquasec/trivy:latest "${args[@]}" /scan || true
  else
    echo "    SKIP: trivy and docker both unavailable (see https://trivy.dev)"
  fi
}

case "${1:-all}" in
  all)       run_govulncheck; run_pnpm_audit; run_trivy ;;
  backend)   run_govulncheck ;;
  frontend)  run_pnpm_audit ;;
  trivy)     run_trivy ;;
  -h|--help) usage; exit 0 ;;
  *)         echo "unknown target: $1"; usage; exit 2 ;;
esac

exit "$fail"
