# TDAT Backend

Go HTTP server that analyzes Java thread dumps to detect performance issues such as deadlocks, high CPU usage, lock contention, thread pool saturation, and more.

## Getting Started

```bash
# Copy the env template and fill in your Anthropic API key
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY=your_key_here

go run .
# Server starts at http://localhost:8080
```

The server logs its listening URL on startup (e.g. `url=http://localhost:8080`) so it can be opened directly. When deploying behind a public hostname, set `PUBLIC_URL` (see below) so the startup log points to the externally reachable URL. A built-in HTML form at that URL can be used for manual testing without the frontend.

If `ANTHROPIC_API_KEY` is not set, analysis still completes and AI insights return a static "unavailable" message instead of failing the job.

## API

### `POST /analyze/jobs`

Upload thread dumps and start an async analysis job.

**Content-Type:** `multipart/form-data`

| Field | Required | Description |
|---|---|---|
| `thread_dumps` | Yes | One or more Java thread dump text files |
| `thread_usages` | No | CPU usage files (`PID TID %CPU TIME` columns). `thread_usages` matches `thread_dumps` by upload index. Entry *i* in `thread_usages` corresponds to entry *i* in `thread_dumps`. The TDAT frontend aligns both arrays by filename before sending; direct POST requests must keep them in the same order. |

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
    "ai_insights": { "executive_summary": "...", "pattern_recognition": "...", "recommended_actions": "..." },
    "errors": []
  },
  "error": "only on failed status"
}
```

`result` is populated only when `status == "completed"`. Returns `404` for unknown job IDs.

### `GET /health`

Returns `200 OK` with body `OK`. Used for liveness probes.

## How It Works

```
POST /analyze/jobs
  └─ Background goroutine:
       ├─ Per file (concurrent): parse dump → correlate CPU usage → classify thread pool → run Grule rules
       ├─ Aggregate: pivot file-centric results into thread-centric history across dumps
       └─ AI: send top threads to Anthropic Claude for executive summary
```

### Rule Engine

28 Grule DSL rules in `internal/rules/rules.grl` are applied concurrently per thread. Each thread matches at most one rule, with the highest salience winning. Rules check `t.Analyzed == false` and set `t.Analyzed = true` in `then`; `Retract()` is not used.

Two unambiguous findings are flagged **natively by the parser** before rules run, since they arrive as JVM summary blocks or single-number signals rather than per-thread state:

- **Deadlocks** - threads listed in the `Found X Java-level deadlock` summary block are tagged `CRITICAL` directly in `ParseThread`.
- **Runaway CPU** - threads with `CPUPercentage >= 100.0` after correlation are tagged `CRITICAL` in `ProcessAndCorrelate`.

Both also set `Analyzed = true` so the rule engine skips them. The corresponding rules (`DeadlockDetection`, `ThreadStarvation`) remain as defensive backups.

| Risk | Examples |
|---|---|
| CRITICAL | Deadlock (parser), runaway CPU ≥100% (parser), thread starvation (>95% CPU), WSO2 PassThrough stuck on socket I/O, PassThrough starvation on backend I/O, DB connection pool exhaustion, critical lock contention (20+ threads on same monitor), catastrophic thread count (5,000+ live threads - GC root explosion) |
| HIGH | Prolonged BLOCKED (>10s), sustained high CPU (>30%), DB wait (>5s), >25% threads blocked system-wide, HTTP worker busy (>5s), high lock contention (3-19 threads on same monitor), generic BLOCKED on monitor, GC activity, LDAP/AD timeouts, OAuth2 token bottleneck, Hazelcast cache contention |
| MEDIUM | Idle threads (>10s), native/socket block with 0% CPU, recursive lock, thread leak |
| INFO | Threads not belonging to any known pool |

### Thread Pool Classification

Threads are matched against regex patterns in `config/thread_pools.yaml`. Supported pools include Tomcat HTTP/HTTPS, WSO2 Synapse/PassThrough, Disruptor, RabbitMQ, MINA, DataBridge, and more.

### Multi-Dump Analysis

When multiple dump files are uploaded, threads are correlated across files by composite identity (`name + id + native_id + pool`), producing a chronological snapshot history per thread. The frontend reuses this same composite as the React row key in `ThreadExplorer`, so distinct histories that share a single `thread.id` do not collide on render.

### AI Insights

Uses Anthropic `claude-haiku-4-5-20251001` with a WSO2/Java performance engineering system prompt. Sends up to 40 high-signal threads (top 3 stack frames each; INFO/normal threads excluded) and returns structured JSON with `executive_summary`, `pattern_recognition`, and `recommended_actions`.

## Configuration

`.env.example` is the template. Copy it to `.env` and override only what you need. Every variable below has a default, so `ANTHROPIC_API_KEY` is the only one you typically set.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(unset)_ | Required for AI insights. If unset, the job still completes and `ai_insights` returns a static "unavailable" message. |
| `LOG_LEVEL` | `INFO` | slog level: `DEBUG` / `INFO` / `WARN` / `ERROR`. |
| `PORT` | `8080` | HTTP listen port. |
| `PUBLIC_URL` | `http://localhost:${PORT}` | Public base URL logged at startup for click-to-test. Set this when running behind a public hostname or reverse proxy. |
| `READ_HEADER_TIMEOUT` | `5s` | Go `time.Duration` string. |
| `READ_TIMEOUT` | `60s` | Go `time.Duration` string. |
| `WRITE_TIMEOUT` | `60s` | Go `time.Duration` string. |
| `IDLE_TIMEOUT` | `120s` | Go `time.Duration` string. |
| `RULES_PATH` | `./internal/rules/rules.grl` | Grule rules file. |
| `THREAD_POOLS_PATH` | `./config/thread_pools.yaml` | Pool-definition YAML. |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated. |
| `CORS_ALLOWED_METHODS` | `GET,POST,OPTIONS,PUT,DELETE` | Comma-separated. |
| `CORS_ALLOWED_HEADERS` | `Accept,Content-Type,Content-Length,Accept-Encoding,X-CSRF-Token,Authorization` | Comma-separated. |
| `CORS_DEBUG` | `false` | When `true`, rs/cors emits per-request debug lines through slog (so they only appear if `LOG_LEVEL=DEBUG`). |
| `MAX_UPLOAD_BYTES` | `100MB` | Multipart upload cap. Accepts `B`, `K`/`KB`/`KiB`, `M`/`MB`/`MiB`, `G`/`GB`/`GiB`. |
| `JOB_TTL` | `1h` | How long terminal (`completed` / `failed`) jobs stay queryable. `pending`/`running` jobs are never expired. |
| `JOB_STORE_MAX_SIZE` | `200` | Max jobs retained in memory. When exceeded, the janitor evicts the oldest **terminal** jobs first; in-flight (`pending`/`running`) jobs are never evicted. |
| `JOB_JANITOR_TICK` | `1m` | Eviction sweep interval. |

### Other config

| Item | Details |
|---|---|
| `config/thread_pools.yaml` | Thread pool name, regex patterns, description, expected behavior. Path overridable via `THREAD_POOLS_PATH`. |
| `internal/rules/rules.grl` | 28 Grule DSL rules. Path overridable via `RULES_PATH`. |

## Building

```bash
go build                    # Build binary (output: ./backend)
go mod tidy                 # Sync dependencies
```

## File Structure

```
backend/
├── main.go                          Entrypoint: .env load, slog setup, engine/enricher/jobStore wiring, http.Server start; AggregatedAnalysisResponse type
├── router.go                        NewRouter (ServeMux + CORS middleware) and the manual-testing HTML form (serveHTML)
├── settings.go                      Config struct + LoadConfig — env-var parsing with sensible defaults
├── jobs.go                          Job/JobStore (TTL + max-size + background janitor), async handlers, runAnalysis pipeline
├── go.mod / go.sum                  Go module definition and dependency lock
├── .env.example                     Tracked template — copy to .env and fill in
├── .env                             Local secrets (gitignored, loaded via godotenv)
├── openapi.yaml                     OpenAPI 3.0 specification for REST API
├── config/
│   └── thread_pools.yaml            Thread pool name/regex/description definitions
└── internal/
    ├── parser/
    │   └── thread_parser.go         Regex parsers, ProcessAndCorrelate, native deadlock + runaway-CPU pre-classification
    ├── analyzer/
    │   ├── enricher.go              ThreadEnricher: loads YAML, classifies threads into pools
    │   ├── rules_engine.go          Grule integration, GlobalStats, AnalyzeThreads
    │   └── aggregator.go            AggregateThreads: file-centric → thread-centric pivot
    ├── rules/
    │   └── rules.grl                28 Grule DSL rules (deadlock, high CPU, lock contention, catastrophic thread count, critical lock contention, DB pool, LDAP, OAuth, Hazelcast, etc.)
    └── ai/
        └── insights.go              Anthropic API call (claude-haiku-4-5), prompt build, JSON response parse
```

## License

This project is licensed under the **Apache License 2.0**. See the main repository for the complete LICENSE file.

```
Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
Licensed under the Apache License, Version 2.0.
```

All source files (`*.go`) include the Apache 2.0 license header at the top of the file.