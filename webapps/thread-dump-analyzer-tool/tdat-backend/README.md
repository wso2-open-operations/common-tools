# TDAT Backend

Go HTTP server that analyzes Java thread dumps to detect performance issues — deadlocks, high CPU usage, lock contention, thread pool saturation, and more.

## Getting Started

```bash
# Copy the env template and fill in your Anthropic API key
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY=your_key_here

go run .
# Server starts at http://localhost:8080
```

A built-in HTML form at `http://localhost:8080` can be used for manual testing without the frontend.

If `ANTHROPIC_API_KEY` is not set, analysis still completes — AI insights return a static "unavailable" message instead of failing the job.

## API

### `POST /api/v1/analyze/jobs`

Upload thread dumps and start an async analysis job.

**Content-Type:** `multipart/form-data`

| Field | Required | Description |
|---|---|---|
| `thread_dumps` | Yes | One or more Java thread dump text files |
| `thread_usages` | No | Matching CPU usage files (`PID TID %CPU TIME` columns), paired by index with dumps |

**Response:** `202 Accepted`
```json
{ "job_id": "uuid-v4" }
```

### `GET /api/v1/analyze/jobs/{id}`

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
POST /api/v1/analyze/jobs
  └─ Background goroutine:
       ├─ Per file (concurrent): parse dump → correlate CPU usage → classify thread pool → run Grule rules
       ├─ Aggregate: pivot file-centric results into thread-centric history across dumps
       └─ AI: send top threads to Anthropic Claude for executive summary
```

### Rule Engine

28 Grule DSL rules in `internal/rules/rules.grl`, applied concurrently per thread. Each thread is matched by at most one rule (highest salience wins). Rules gate on `t.Analyzed == false` and set `t.Analyzed = true` in `then` — no `Retract()` is used (it would thrash working memory).

Two unambiguous findings are flagged **natively by the parser** before rules run, since they arrive as JVM summary blocks or single-number signals rather than per-thread state:

- **Deadlocks** — threads listed in the `Found X Java-level deadlock` summary block are tagged `CRITICAL` directly in `ParseThread`.
- **Runaway CPU** — threads with `CPUPercentage >= 100.0` after correlation are tagged `CRITICAL` in `ProcessAndCorrelate`.

Both also set `Analyzed = true` so the rule engine skips them. The corresponding rules (`DeadlockDetection`, `ThreadStarvation`) remain as defensive backups.

| Risk | Examples |
|---|---|
| CRITICAL | Deadlock (parser), runaway CPU ≥100% (parser), thread starvation (>95% CPU), WSO2 PassThrough stuck on socket I/O, PassThrough starvation on backend I/O, DB connection pool exhaustion, critical lock contention (20+ threads on same monitor), catastrophic thread count (5,000+ live threads — GC root explosion) |
| HIGH | Prolonged BLOCKED (>10s), sustained high CPU (>30%), DB wait (>5s), >25% threads blocked system-wide, HTTP worker busy (>5s), high lock contention (3–19 threads on same monitor), generic BLOCKED on monitor, GC activity, LDAP/AD timeouts, OAuth2 token bottleneck, Hazelcast cache contention |
| MEDIUM | Idle threads (>10s), native/socket block with 0% CPU, recursive lock, thread leak |
| INFO | Threads not belonging to any known pool |

### Thread Pool Classification

Threads are matched against regex patterns in `config/thread_pools.yaml`. Supported pools include Tomcat HTTP/HTTPS, WSO2 Synapse/PassThrough, Disruptor, RabbitMQ, MINA, DataBridge, and more.

### Multi-Dump Analysis

When multiple dump files are uploaded, threads are correlated across files by composite identity (`name + id + native_id + pool`), producing a chronological snapshot history per thread.

### AI Insights

Uses Anthropic `claude-haiku-4-5-20251001` with a WSO2/Java performance engineering system prompt. Sends up to 40 high-signal threads (top 3 stack frames each; INFO/normal threads excluded) and returns structured JSON with `executive_summary`, `pattern_recognition`, and `recommended_actions`.

## Configuration

| Item | Details |
|---|---|
| `.env.example` | Tracked template listing the env vars the server reads — copy to `.env` and fill in |
| `ANTHROPIC_API_KEY` | Set in `.env` or environment. Required for AI insights; if unset, the job still completes and `ai_insights` returns a static "unavailable" message |
| `CORS_DEBUG` | Optional, set to `"true"` to enable `rs/cors` debug logging |
| `config/thread_pools.yaml` | Thread pool name, regex patterns, description, expected behavior |
| Upload limit | 100 MB per multipart form |
| CORS | Open to all origins (`*`) |

## Building

```bash
go build -o tdat-backend    # Build binary
go mod tidy                 # Sync dependencies
```

## File Structure

```
tdat-backend/
├── main.go                          HTTP server, route wiring, AggregatedAnalysisResponse
├── jobs.go                          Job/JobStore, async handlers, runAnalysis pipeline
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
Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
Licensed under the Apache License, Version 2.0.
```

All source files (`*.go`) include the Apache 2.0 license header at the top of the file.
