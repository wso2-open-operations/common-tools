# Contributing to TDAT (Thread Dump Analysis Tool)

Welcome. This guide covers everything you need to contribute to this tool, whether you're adding a Grule rule, building a frontend panel, updating configuration, or improving docs.

TDAT is two sibling projects: a Go API in `backend/` and a React 19 + TypeScript SPA in `frontend/`. Read [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) before writing any code. They define the architecture, data structures, and patterns each side must follow. The root [README.md](README.md) covers the system end to end.

This tool lives in the `wso2-open-operations/common-tools` monorepo at `apps/thread-dump-analyzer-tool`. All paths below are relative to that directory.

---

## Prerequisites

- Go >= 1.24 (matches `backend/go.mod`)
- Node.js >= 20
- pnpm >= 9 (the frontend's package manager)
- Docker + Docker Compose (optional, for the full-stack run)
- An `ANTHROPIC_API_KEY` for AI insights (optional: jobs still complete without one, insights return a static "unavailable" message)

See the root [README.md](README.md) for full environment setup and the Docker deployment notes.

---

## Dev Workflow

### Running the backend

```bash
cd backend
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY (optional), and AUTH_ENABLED=false for local testing
go run .
# Server starts at http://localhost:8080
```

Auth is ON by default. Set `AUTH_ENABLED=false` to make the `/analyze/jobs` endpoints public for local work; otherwise the server refuses to start unless `ASGARDEO_BASE_URL` (or `JWT_JWKS_URL` + `JWT_ISSUER`) is set. Every other knob has a default in `settings.go#LoadConfig`; see `backend/.env.example`.

### Running the frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: set VITE_ASGARDEO_CLIENT_ID and VITE_ASGARDEO_BASE_URL
pnpm install
pnpm dev
```

The SPA reads the backend URL from `public/config.js` at runtime via `window.configs.apiUrl`. Point it at `http://localhost:8080` for local development.

### Running the full stack with Docker

```bash
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY, ASGARDEO_BASE_URL, ASGARDEO_CLIENT_ID
docker compose up --build
# Frontend on http://localhost:8081, backend on http://localhost:8080
```

### Manual testing with the built-in form

The backend serves an HTML upload form at `http://localhost:8080` (`GET /`). Run with `AUTH_ENABLED=false`, since the form sends no token, then upload a thread dump to exercise the full pipeline without the SPA.

### Running the backend test suite

```bash
cd backend
gofmt -l .         # list unformatted files (should be empty)
go vet ./...       # static checks
go build           # confirm it compiles
go test ./...      # parser, analyzer, ai, auth, jobs, limiters
```

The frontend has no JS unit-test runner configured yet; `pnpm lint` plus a clean `pnpm build` (which runs `tsc -b`) is the bar. Verify UI changes by hand in `pnpm dev`.

---

## License Headers

Every source file (`.go`, `.ts`, `.tsx`) must begin with the full Apache 2.0 header below, at the very top before any imports or code. Files without it will not be accepted. Copy it verbatim from any existing source file:

```text
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
```

---

## Branch and PR Conventions

- Branch naming: `feat/<description>`, `fix/<description>`, `docs/<description>`, `refactor/<description>`
- Push to your fork: `git push -u origin feat/my-change`
- Open a PR from your fork branch to `wso2-open-operations/common-tools:main`
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit subjects (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`)
- Keep one logical change per PR; squash noisy work-in-progress commits before review

---

## Code Review Checklist

Before requesting review, verify your changes:

**License headers:**
- [ ] Every new `.go` / `.ts` / `.tsx` file carries the full Apache 2.0 header

**Backend (Go):**
- [ ] `gofmt` clean (no diff), `go vet ./...` clean
- [ ] `go build` succeeds and `go test ./...` passes
- [ ] New or changed parsing/rules/aggregation/scoring logic has a test in the matching `_test.go`
- [ ] Code stays within the existing `internal/` layout (`parser`, `analyzer`, `ai`, `rules`)

**Frontend (TypeScript / React):**
- [ ] `pnpm lint` clean and `pnpm build` succeeds (type-check gate)
- [ ] Imports use the configured path aliases (`@component/*`, `@pages/*`, `@hooks/*`, etc.)
- [ ] Components follow the layering convention in `frontend/README.md` (`component/ui`, `component/common`, `pages/<page>/components`, `utils`)
- [ ] Lists of threads key on the full composite identity `{id, name, native_id, thread_pool}`, not `id` alone

**Comments and prose:**
- [ ] Comments are single-line and explain *why*, not *what*
- [ ] Docs and comments prefer commas, colons, or parentheses over em-dashes

**Documentation:**
- [ ] Behaviour, config, or API change is reflected in the relevant `README.md`
- [ ] Added a Grule rule? `internal/analyzer/patterns.go` is updated to match

---

## Updating Rules and Configuration

### `rules.grl`: thread classification rules

**File:** `backend/internal/rules/rules.grl`

Each thread is matched by the highest-salience rule that fires, then flagged so no lower rule re-fires on it. A rule guards its `when` with `t.Analyzed == false` and ends its `then` with `t.Analyzed = true`:

```text
rule SustainedHighCPU "Threads consuming >30% CPU" salience 80 {
    when
        t.Analyzed == false && t.State == "RUNNABLE" && t.CPUPercentage > 30.0
    then
        t.RiskLevel = "HIGH";
        t.AddIssue("Sustained High CPU Usage (" + t.CPUPercentage + "%)");
        t.Recommendation = "Investigate the stack trace for heavy computations or infinite loops.";
        t.Analyzed = true;
}
```

To add a rule:
1. Write the rule, guarding `t.Analyzed == false` and setting `t.Analyzed = true` in `then`.
2. Choose a salience that slots it correctly against the existing rule order (see the salience table in `backend/README.md`).
3. Add a matching entry to the `rulePatterns` registry in `internal/analyzer/patterns.go`, where `IssuePrefix` is the leading substring of the string your rule passes to `AddIssue`:
   ```go
   {"SustainedHighCPU", "Sustained High CPU Usage"},
   ```
4. Add or extend a case in `internal/analyzer/rules_engine_test.go`; `patterns_test.go` guards that the registry stays in lockstep with the rules.
5. Document the rule in `backend/README.md`.

### `thread_pools.yaml`: thread pool classification

**File:** `backend/config/thread_pools.yaml`

Maps a pool name to one or more name regexes; the enricher assigns each thread to the first pool whose pattern matches, falling back to `"Standalone/ Ungrouped Threads"`.

```yaml
  - name: "Tomcat HTTP Threads"
    patterns:
      - "^http-nio-\\d+-exec-\\d+$"
    description: "Worker threads that process incoming HTTP web requests."
    expected_behavior: "Usually WAITING for a request; RUNNABLE while processing."
```

To add a pool:
1. Add an entry under `pools:` with `name`, `patterns`, `description`, and `expected_behavior`.
2. Anchor the regex (`^...$`) and test it against real thread names from a dump.
3. Add a case to `internal/analyzer/enricher_test.go`.

### `settings.go` / `.env.example`: backend configuration knobs

**File:** `backend/settings.go` and `backend/.env.example`

All runtime configuration is read once in `LoadConfig` with a sensible default, so the server runs with an empty `.env`.

To add a knob:
1. Add the field to the `Config` struct and parse it in `LoadConfig`, with a default.
2. Document it (with a comment) in `backend/.env.example`.
3. Update the env-var table in `backend/README.md`.

---

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0, the same license that covers this project.

```text
Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
```
