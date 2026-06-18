# TDAT Backend

Go HTTP server that analyzes Java thread dumps to detect performance issues such as deadlocks, high CPU usage, lock contention, thread pool saturation, and more.

## Getting Started

```bash
# Copy the env template and fill in your Anthropic API key
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY=your_key_here
# Auth is ON by default: set ASGARDEO_BASE_URL, or AUTH_ENABLED=false for local testing

go run .
# Server starts at http://localhost:8080
```

The server logs its listening URL on startup (e.g. `url=http://localhost:8080`) so it can be opened directly. When deploying behind a public hostname, set `PUBLIC_URL` (see below) so the startup log points to the externally reachable URL. A built-in HTML form at that URL can be used for manual testing without the frontend.

If `ANTHROPIC_API_KEY` is not set, analysis still completes and AI insights return a static "unavailable" message instead of failing the job.

**Authentication is on by default** (`AUTH_ENABLED=true`). The server **refuses to start** unless `ASGARDEO_BASE_URL` (or `JWT_JWKS_URL` + `JWT_ISSUER`) is set, and `/analyze/jobs` then requires a valid Bearer JWT. The built-in HTML form sends no token, so for manual testing set `AUTH_ENABLED=false` to make the analyze endpoints public (local use only). See [Authentication](#authentication) below.

## API

### Authentication

When `AUTH_ENABLED` (default `true`), `POST /analyze/jobs` and `GET /analyze/jobs/{id}` require an `Authorization: Bearer <jwt>` header. Tokens are validated in `auth.go` against the Asgardeo JWKS (signature plus `exp`/`nbf`/`iss`, and `aud` when `JWT_AUDIENCE` is set) using a cached, auto-refreshing key set with 60s clock skew. Missing or invalid tokens get `401` with a `WWW-Authenticate: Bearer` challenge. `GET /health` and the `GET /` HTML form stay open. CORS wraps the mux, so preflight `OPTIONS` is answered before auth and `401`s still carry CORS headers.

Set `ASGARDEO_BASE_URL` and the JWKS endpoint + issuer are derived (`<base>/oauth2/jwks`, `<base>/oauth2/token`); override either with `JWT_JWKS_URL` / `JWT_ISSUER`. With `AUTH_ENABLED=false` the analyze endpoints are public (local testing only).

### `POST /analyze/jobs`

Upload thread dumps and start an async analysis job.

**Content-Type:** `multipart/form-data`

| Field | Required | Description |
|---|---|---|
| `thread_dumps` | Yes | One or more Java thread dump text files |
| `thread_usages` | No | CPU usage files. Each row is whitespace-separated; columns are mapped by header name when present (thread id from `TID`/`LWP`/`SPID`, cpu from `%CPU`/`PCPU`/`CPU`; extra columns like `NLWP`/`C` ignored), falling back to fixed `PID TID %CPU TIME` positions when headerless. TID may be decimal or hex (`0x...`). TIME accepts `HH:MM:SS`, `MM:SS.mmm`, or plain seconds. Example row: `1234 12345 25.5 00:01:23`. Indexed in upload order: entry *i* in `thread_usages` corresponds to entry *i* in `thread_dumps`. The TDAT frontend aligns both arrays by filename before sending; direct POST requests must keep them in the same order. |

**Response:** `202 Accepted`
```json
{ "job_id": "uuid-v4" }
```

### `GET /analyze/jobs/{id}`

Poll for job status and result.

**Response:** `200 OK`
```json
{
  "job_id": "uuid-v4",
  "status": "pending | running | completed | failed",
  "created_at": "2026-04-22T10:00:00Z",
  "updated_at": "2026-04-22T10:00:05Z",
  "result": {
    "session_id": "uuid-v4",
    "timestamp": "2026-04-22T10:00:00Z",
    "threads": [ ...AnalyzedThread ],
    "thread_pools": { "Pool Name": { "description": "...", "expected_behavior": "..." } },
    "health_score": 82,
    "health_factors": [
      { "label": "3 blocked threads", "penalty": 8 },
      { "label": "2 critical-risk threads", "penalty": 24 }
    ],
    "pattern_matches": [
      { "rule_name": "DatabaseWait", "issue_prefix": "Thread executing Database/JDBC operations for > 5s", "matched_thread_count": 3 }
    ],
    "ai_insights": { "executive_summary": "...", "pattern_recognition": "...", "recommended_actions": "..." },
    "errors": []
  },
  "error": "only on failed status"
}
```

`result` is populated only when `status == "completed"`. Returns `404` for unknown job IDs.

Uploads are validated fail-fast: if any uploaded file is not analyzable (a non-dump file with no parseable threads, or a malformed `thread_usages` file with no usable rows), the job ends as `failed` with an `error` that names the offending file, e.g. `Invalid file: no Java threads found in "usage.txt". Is it a Java thread dump?`. No partial `result` is produced in that case.

### `GET /health`

Returns `200 OK` with body `OK`. Used for liveness probes.

### Rate Limiting

`POST /analyze/jobs` is gated by two independent layers, both returning HTTP `429`:

- **Per-IP token bucket** (`IPLimiter` in `router.go`): default 0.5 RPS, burst 5, 1h visitor TTL. Trusts `r.RemoteAddr` only (not `X-Forwarded-For`). Tune via `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST`, `RATE_LIMIT_VISITOR_TTL`, `RATE_LIMIT_JANITOR_TICK`.
- **Concurrent-job semaphore** (`JobLimiter` in `jobs.go`): caps in-flight analyses at `MAX_CONCURRENT_JOBS` (default 10). The slot is acquired after multipart parsing and released when the analysis goroutine exits.

## How It Works

```text
POST /analyze/jobs
  └─ Background goroutine:
       ├─ Per file (concurrent): parse dump → correlate CPU usage (DEBUG-logs match counts;
       │                         WARN on zero matches) → classify thread pool
       ├─ Validate (fail-fast): any non-dump file (0 threads) or malformed usage file (0 rows)
       │                        fails the whole job with a clear, file-named error (no partial result)
       ├─ Run Grule rules per thread (only when every uploaded file is valid)
       ├─ Aggregate: pivot file-centric results into thread-centric history across dumps
       ├─ Pattern matches: per-rule unique-thread counts for the frontend
       ├─ Health: deterministic 0-100 score + named penalty factors from the latest dump
       └─ AI: send top threads to Anthropic Claude for executive summary
```

### Rule Engine

29 Grule DSL rules in `internal/rules/rules.grl` are applied concurrently per thread. Each thread matches at most one rule, with the highest salience winning. Rules check `t.Analyzed == false` and set `t.Analyzed = true` in `then`; `Retract()` is not used.

Two unambiguous findings are flagged **natively by the parser** before rules run, since they arrive as JVM summary blocks or single-number signals rather than per-thread state:

- **Deadlocks** - threads listed in the `Found X Java-level deadlock` summary block are tagged `CRITICAL` directly in `ParseThread`.
- **Runaway CPU** - threads with `CPUPercentage >= 100.0` after correlation are tagged `CRITICAL` in `ProcessAndCorrelate`.

Both also set `Analyzed = true` so the rule engine skips them. The corresponding rules (`DeadlockDetection`, `ThreadStarvation`) remain as defensive backups.

| Risk | Examples |
|---|---|
| CRITICAL | Deadlock (parser), runaway CPU ≥100% (parser), thread starvation (>95% CPU), WSO2 PassThrough stuck on socket I/O, PassThrough starvation on backend I/O, DB connection pool exhaustion, critical lock contention (20+ threads on same monitor), catastrophic thread count (5,000+ live threads - GC root explosion) |
| HIGH | Prolonged BLOCKED (>10s), sustained high CPU (>30%), DB wait (>5s, gated on ≥2 system-wide stalls), >25% threads blocked system-wide, HTTP worker busy (>5s), high lock contention (3-19 threads on same monitor), generic BLOCKED on monitor, GC activity, LDAP/AD timeouts, OAuth2 token bottleneck, Hazelcast cache contention |
| MEDIUM | Idle threads (>10s), native/socket block with 0% CPU, recursive lock, thread leak |
| INFO | Threads not belonging to any known pool; sustained CPU ≥20% with no other rule match (low-severity backstop; cross-check against known benign product threads) |

### Thread Pool Classification

Threads are matched against regex patterns in `config/thread_pools.yaml`. Supported pools include Tomcat HTTP/HTTPS, WSO2 Synapse/PassThrough, Disruptor, RabbitMQ, MINA, DataBridge, and more.

### Multi-Dump Analysis

When multiple dump files are uploaded, threads are correlated across files by composite identity (`name + id + native_id + pool`), producing a chronological snapshot history per thread. The frontend reuses this same composite as the React row key in `ThreadExplorer`, so distinct histories that share a single `thread.id` do not collide on render.

### AI Insights

Uses Anthropic `claude-haiku-4-5-20251001` with a WSO2/Java performance engineering system prompt. Sends up to 40 high-signal threads (top 3 stack frames each; INFO/normal threads excluded) and returns structured JSON with `executive_summary`, `pattern_recognition`, and `recommended_actions`.

### Pattern Matches

`result.pattern_matches[]` exposes per-rule unique-thread counts so the frontend can render rule-level summaries without substring-scanning `issues[]`. Each entry has `{rule_name, issue_prefix, matched_thread_count}` and is populated only when a rule fired. The rule to issue-prefix registry lives in `internal/analyzer/patterns.go` and must stay in lockstep with `rules.grl`; adding a rule means appending one entry.

### Health Score

`internal/analyzer/health.go#ComputeHealth` returns a deterministic 0-100 `health_score` plus the `health_factors[]` behind it, both computed from the latest dump's threads only. The latest dump is chosen by natural-sorting dump filenames (so `dump_2` sorts before `dump_10`), mirroring the frontend so the rendered score matches.

The score starts at 100 and subtracts:

| Penalty | Basis | Weight / Cap |
|---|---|---|
| Blocked threads | share of latest-dump threads | weight 50 |
| Waiting threads | share of latest-dump threads | weight 15 |
| Timed-waiting threads | share of latest-dump threads | weight 5 |
| Critical-risk threads | count (not share), so one acute thread still moves the needle | 12 each, capped at 45 |
| Thread-count growth | percent growth vs. the previous dump | growth% / 2, capped at 15 |

Each penalty greater than 0 becomes a `health_factor` (`{label, penalty}`); the penalties sum to `100 - health_score`. With no dumps or no threads the score is 100 and `health_factors` is omitted.

## Configuration

`.env.example` is the template. Copy it to `.env` and override only what you need. Every variable below has a default, so `ANTHROPIC_API_KEY` is the only one you typically set.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(unset)_ | Required for AI insights. If unset, the job still completes and `ai_insights` returns a static "unavailable" message. |
| `AUTH_ENABLED` | `true` | Require a Bearer JWT on `/analyze/jobs` (POST + GET). `false` makes those endpoints public (local testing only). When `true`, the server refuses to start unless the issuer/JWKS below resolve. |
| `ASGARDEO_BASE_URL` | _(unset)_ | Asgardeo tenant base URL, e.g. `https://api.asgardeo.io/t/<org>`. JWKS (`/oauth2/jwks`) and issuer (`/oauth2/token`) are derived from it. Required when auth is on unless the two below are set. |
| `JWT_JWKS_URL` | _(derived)_ | Explicit JWKS endpoint; overrides the value derived from `ASGARDEO_BASE_URL`. |
| `JWT_ISSUER` | _(derived)_ | Expected `iss` claim; overrides the value derived from `ASGARDEO_BASE_URL`. |
| `JWT_AUDIENCE` | _(unset)_ | Expected `aud` claim (set to the app's client ID). Empty = `aud` not checked. |
| `LOG_LEVEL` | `INFO` | slog level: `DEBUG` / `INFO` / `WARN` / `ERROR`. |
| `LOG_FILE` | `logs/tdat-session-<ts>.log` | Path (relative to the working directory, or absolute) for the plain-text session log mirrored alongside console output. Set an explicit path to pin it, or `off`/`none`/`-` to disable file logging. Open/create failures fall back to console-only with a warning. |
| `PORT` | `8080` | HTTP listen port. |
| `PUBLIC_URL` | `http://localhost:${PORT}` | Public base URL logged at startup for click-to-test. Set this when running behind a public hostname or reverse proxy. |
| `READ_HEADER_TIMEOUT` | `30s` | Go `time.Duration` string. |
| `READ_TIMEOUT` | `10m` | Go `time.Duration` string. Bounds the full multipart upload window; keep generous for large uploads. |
| `WRITE_TIMEOUT` | `10m` | Go `time.Duration` string. Counts from header receipt, so also bounds the upload window. |
| `IDLE_TIMEOUT` | `5m` | Go `time.Duration` string. Keep-alive idle timeout between polling GETs. |
| `RULES_PATH` | `./internal/rules/rules.grl` | Grule rules file. |
| `THREAD_POOLS_PATH` | `./config/thread_pools.yaml` | Pool-definition YAML. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated. Restrictive by default; set to your frontend origin(s) in prod; never use `*` without backend auth. |
| `CORS_ALLOWED_METHODS` | `GET,POST,OPTIONS` | Comma-separated. |
| `CORS_ALLOWED_HEADERS` | `Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization` | Comma-separated. |
| `CORS_DEBUG` | `false` | When `true`, rs/cors emits per-request debug lines through slog (so they only appear if `LOG_LEVEL=DEBUG`). |
| `MAX_UPLOAD_BYTES` | `100MB` | Multipart upload cap. Accepts `B`, `K`/`KB`/`KiB`, `M`/`MB`/`MiB`, `G`/`GB`/`GiB`. |
| `JOB_TTL` | `1h` | How long terminal (`completed` / `failed`) jobs stay queryable. `pending`/`running` jobs are never expired. |
| `JOB_STORE_MAX_SIZE` | `200` | Max jobs retained in memory. When exceeded, the janitor evicts the oldest **terminal** jobs first; in-flight (`pending`/`running`) jobs are never evicted. |
| `JOB_JANITOR_TICK` | `1m` | Eviction sweep interval. |
| `JOB_TIMEOUT` | `2m` | Per-job deadline. On expiry the job is marked `failed` and the pipeline aborts at its next checkpoint. |
| `MAX_CONCURRENT_JOBS` | `10` | Counting semaphore on in-flight analyses; excess POSTs get `429`. |
| `RATE_LIMIT_RPS` | `0.5` | Per-IP token-bucket refill rate (requests/sec) for POST `/analyze/jobs`. |
| `RATE_LIMIT_BURST` | `5` | Per-IP token-bucket burst capacity. |
| `RATE_LIMIT_VISITOR_TTL` | `1h` | How long an idle IP's bucket is remembered before eviction. |
| `RATE_LIMIT_JANITOR_TICK` | `5m` | Background sweep interval for IP visitor eviction. |

### Other config

| Item | Details |
|---|---|
| `config/thread_pools.yaml` | Thread pool name, regex patterns, description, expected behavior. Path overridable via `THREAD_POOLS_PATH`. |
| `internal/rules/rules.grl` | 29 Grule DSL rules. Path overridable via `RULES_PATH`. |

### Logging

Logs are written by `slog` through a readable handler ([`tint`](https://github.com/lmittmann/tint)): short wall-clock timestamps and abbreviated levels, colorized when stderr is a real terminal and plain otherwise (piped output, Docker, Choreo).

```text
13:03:23.166 INF server listening addr=:8080 url=http://localhost:8080 max_upload_mib=100
```

The same records are mirrored to a per-session log file (plain text, no color codes, so it greps cleanly). By default each server start opens a fresh `logs/tdat-session-<timestamp>.log` relative to the working directory; the chosen path is logged at startup. Override the path with `LOG_FILE=/some/path.log`, or disable file logging with `LOG_FILE=off`. If the file cannot be created, the server warns once and continues console-only. `LOG_LEVEL` controls verbosity for both sinks.

## Building

```bash
go build                    # Build binary (output: ./backend)
go mod tidy                 # Sync dependencies
```

## Docker

```bash
docker build -t tdat-backend .
docker run -p 8080:8080 \
  -e ANTHROPIC_API_KEY=... -e ASGARDEO_BASE_URL=... \
  -e CORS_ALLOWED_ORIGINS=https://your-frontend-origin \
  tdat-backend
```

Multi-stage build: a static `CGO_ENABLED=0` binary on `alpine`. The image copies the runtime files the server reads (`config/thread_pools.yaml`, `internal/rules/rules.grl`) and bundles `ca-certificates` for the outbound HTTPS call to Anthropic. It runs as a non-root user (UID 10014, in Choreo's 10000-20000 range) and honors `PORT` when a platform injects one. `ANTHROPIC_API_KEY` and the settings above are supplied at runtime, never baked in. For the full stack (backend plus frontend) use the root `docker-compose.yml`; see the root README "Run with Docker".

## Testing

```bash
go test ./...               # Run all unit tests
```

Unit tests live in `*_test.go` files beside the code they cover: parser, enricher, rules engine, aggregator, pattern matching, health scoring, and AI prompt construction under `internal/`, plus job store, rate/concurrency limiters, and JWT auth at the package root.

## File Structure

```text
backend/
├── main.go                          Entrypoint: .env load, logger init, engine/enricher/jobStore wiring, http.Server start; AggregatedAnalysisResponse type
├── logging.go                       initLogger: readable slog setup (tint console + plain session-file copy via fanout handler); honors LOG_LEVEL/LOG_FILE
├── router.go                        NewRouter (ServeMux + CORS middleware), IPLimiter (per-IP rate limit), and the manual-testing HTML form (serveHTML)
├── auth.go                          Authenticator: Bearer-JWT validation against the Asgardeo JWKS (RequireAuth middleware)
├── settings.go                      Config struct + LoadConfig: env-var parsing with sensible defaults
├── jobs.go                          Job/JobStore (TTL + max-size + background janitor), JobLimiter (concurrency semaphore), async handlers, runAnalysis pipeline
├── *_test.go                        Unit tests (auth, jobs, limiters; plus per-package tests under internal/)
├── go.mod / go.sum                  Go module definition and dependency lock
├── .env.example                     Tracked template: copy to .env and fill in
├── .env                             Local secrets (gitignored, loaded via godotenv)
├── openapi.yaml                     OpenAPI 3.0 specification for REST API
├── config/
│   └── thread_pools.yaml            Thread pool name/regex/description definitions
└── internal/
    ├── parser/
    │   └── thread_parser.go         Regex parsers, ProcessAndCorrelate, native deadlock + runaway-CPU pre-classification
    ├── analyzer/
    │   ├── enricher.go              ThreadEnricher: loads YAML, classifies threads into pools
    │   ├── rules_engine.go          Grule integration, GlobalStats (incl. JDBCStallCount), AnalyzeThreads
    │   ├── aggregator.go            AggregateThreads: file-centric to thread-centric pivot
    │   ├── patterns.go              PatternMatch + ComputePatternMatches: per-rule unique-thread counts
    │   └── health.go                ComputeHealth: deterministic 0-100 score + named penalty factors
    ├── rules/
    │   └── rules.grl                29 Grule DSL rules (deadlock, high CPU, lock contention, catastrophic thread count, critical lock contention, DB pool, LDAP, OAuth, Hazelcast, low-severity high-CPU backstop, etc.)
    └── ai/
        └── insights.go              Anthropic API call (claude-haiku-4-5), prompt build, JSON response parse
```

## License

This project is licensed under the **Apache License 2.0**. See the main repository for the complete LICENSE file.

```text
Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
Licensed under the Apache License, Version 2.0.
```

All source files (`*.go`) include the Apache 2.0 license header at the top of the file.