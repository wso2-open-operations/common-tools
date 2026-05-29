# Thread Dump Analysis Tool (TDAT)

A full-stack tool for analyzing Java thread dumps to detect performance issues like deadlocks, high CPU usage, lock contention, thread pool saturation, and more.

## Overview

Upload one or more Java thread dump files (and optionally CPU usage metrics) and get:

- Per-thread risk classification (CRITICAL / HIGH / MEDIUM / INFO) via a Grule rule engine
- A deterministic 0-100 health score with named penalty factors (blocked/waiting shares, critical-risk count, thread growth)
- Thread pool identification (Tomcat, WSO2, Disruptor, RabbitMQ, MINA, etc.)
- Lock contention graph mapping each lock owner to the threads it is blocking, plus deadlock cycle detection
- Chronological thread history when multiple dumps are uploaded
- AI-generated executive summary, pattern recognition, and recommended actions (via Anthropic Claude)

## Projects

| Directory | Stack | Description |
|---|---|---|
| `backend/` | Go | HTTP API server that parses dumps, runs Grule rules, and calls Anthropic AI |
| `frontend/` | React 19 + TypeScript + Vite | SPA - upload, dashboard, thread explorer, lock contention view |

## Getting Started

### Backend

```bash
cd backend
# Copy the env template and fill in your Anthropic API key
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY=your_key_here
# Auth is ON by default: set ASGARDEO_BASE_URL, or AUTH_ENABLED=false for local testing

go run .
# Server starts at http://localhost:8080
```

If `ANTHROPIC_API_KEY` is not set, the server still runs and analysis completes (AI insights will return a static "unavailable" message instead of an error).

**Authentication is enabled by default** (`AUTH_ENABLED=true`): the `/analyze/jobs` endpoints require an `Authorization: Bearer <jwt>` header validated against Asgardeo, and the server **refuses to start** unless `ASGARDEO_BASE_URL` (or `JWT_JWKS_URL` + `JWT_ISSUER`) is configured. For local testing without an identity provider, set `AUTH_ENABLED=false` to make the endpoints public.

CORS defaults to allowing only `http://localhost:5173`. For other origins set `CORS_ALLOWED_ORIGINS` in `.env` (comma-separated).

### Frontend

```bash
cd frontend
# Copy and fill in Asgardeo auth config
cp .env.example .env.local
# Edit .env.local: set VITE_ASGARDEO_CLIENT_ID and VITE_ASGARDEO_BASE_URL

pnpm install
pnpm dev
```

The frontend reads the backend URL from `public/config.js` at runtime via `window.configs.apiUrl`. For local development, update that file to point to `http://localhost:8080`.

## API

```text
POST /analyze/jobs          # Upload files → returns { job_id } (202 Accepted)
GET  /analyze/jobs/{id}     # Poll for result → { status, result }
GET  /health                        # Liveness probe
GET  /                              # HTML upload form for manual testing
```

When `AUTH_ENABLED` (the default), both `/analyze/jobs` endpoints require an `Authorization: Bearer <jwt>` header (validated against Asgardeo) and return `401` otherwise; `GET /health` and the `GET /` form stay open.

The analysis runs asynchronously. Poll the status endpoint until `status` is `completed` or `failed`. Jobs run under a configurable deadline (`JOB_TIMEOUT`, default 2m); on expiry the job is marked `failed` and the pipeline exits at the next checkpoint.

**Upload fields (multipart/form-data):**
- `thread_dumps` - required, one or more Java thread dump `.txt`/`.log` files
- `thread_usages` - optional, matching CPU usage files. Whitespace-separated `PID TID %CPU TIME` rows (header `PID` row optional). TID may be decimal or hex (`0x...`). TIME accepts `HH:MM:SS`, `MM:SS.mmm`, or plain seconds. Example row: `1234 12345 25.5 00:01:23`.

When multiple dump files are uploaded, TDAT correlates threads across snapshots by composite identity (`name + id + native_id + pool`) to show how thread state evolved over time. The frontend reuses the same composite as the React key for each thread row, so distinct histories sharing a single `thread.id` do not collide during sort/filter.

Dump and usage files are paired client-side by a normalized filename key (`utils/uploadValidation.ts#extractFileKey`): known prefixes (`threaddump`, `threadusage`, `dump`, `usage`, `td`, `tu`, etc.) are stripped only at a `_`/`-`/`.` boundary or end-of-string, so generic prefixes do not eat into unrelated filenames.

**Result shape:**
```json
{
  "session_id": "uuid",
  "timestamp": "RFC3339",
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
}
```

`pattern_matches[]` gives the frontend authoritative per-rule unique-thread counts without having to substring-scan `issues[]`. Omitted when no rule fired.

`health_score` is a deterministic 0-100 score computed by the backend from the latest dump, and `health_factors[]` lists the named penalties behind it (the penalties sum to `100 - health_score`). The frontend renders these directly as a gauge with a breakdown tooltip, so the displayed number always matches the backend.

**Rate limiting**: `POST /analyze/jobs` is gated by two independent layers, both returning HTTP 429:
- **Per-IP token bucket** (`IPLimiter` in `router.go`): defaults to 0.5 RPS, burst 5, 1h visitor TTL. Trusts `r.RemoteAddr` only (not `X-Forwarded-For`). Configurable via `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST`, `RATE_LIMIT_VISITOR_TTL`, `RATE_LIMIT_JANITOR_TICK`.
- **Concurrent job semaphore** (`JobLimiter` in `jobs.go`): caps in-flight analyses to prevent memory exhaustion under burst load. Defaults to 10 (`MAX_CONCURRENT_JOBS`). The slot is acquired after multipart parsing and released when the analysis goroutine exits.

## Features

### Rule Engine (29 rules)

Rules are defined in `backend/internal/rules/rules.grl` using the Grule DSL. Each thread is matched by the highest-salience rule that fires, then marked as analyzed so no second rule re-fires on it. The engine avoids `Retract()` and gates on the `Analyzed` flag instead, which prevents working-memory thrashing. Two unambiguous findings are pre-flagged directly by the parser before rules run: JVM-reported deadlocks, and runaway threads at ≥100% CPU. Key rules:

- **Deadlock detection** - threads flagged in the JVM deadlock summary section (salience 100; parser pre-flags as CRITICAL)
- **PassThrough starvation** - `PassThroughMessageProcessor-` threads blocked on backend I/O via NIO reactor or socket read (salience 96)
- **WSO2 I/O stuck** - PassThrough threads RUNNABLE with 0% CPU stuck on socket I/O (salience 95)
- **DB connection pool exhaustion** - threads parked in `ConnectionPool.borrowConnection` (salience 92)
- **High global blockage** - >25% of all threads BLOCKED system-wide (salience 88)
- **Thread starvation** - single thread consuming >95% CPU (salience 86; parser pre-flags ≥100% as runaway)
- **Database waits** - threads in JDBC/Hibernate calls for >5s, gated on ≥2 system-wide stalls so single-thread cases fall to lower-priority rules (salience 85)
- **GC detection** - threads waiting in GC-related stack frames (salience 85)
- **Critical lock contention** - 20+ threads queued on the same monitor address; at this scale the protected operation is fully serialized and represents a transport-level throughput failure (salience 84; CRITICAL)
- **High lock contention** - 3+ threads waiting on the same monitor address (salience 83)
- **Catastrophic thread count** - RUNNABLE native/socket threads in a JVM with 5,000+ live threads; each thread is a GC root and at this scale the GC must scan tens of thousands of stacks on every collection cycle, causing high CPU even though individual threads are idle - a classic thread leak signature (salience 82; CRITICAL)
- **High CPU** - RUNNABLE threads with >30% CPU usage (salience 80)
- **LDAP / user store timeouts** - threads in `javax.naming` / `com.sun.jndi.ldap` / WSO2 LDAP user store (salience 78)
- **OAuth2 token bottleneck** - BLOCKED/WAITING in `org.wso2.carbon.identity.oauth2` (salience 77)
- **HTTP bottleneck** - Tomcat HTTP/HTTPS workers busy or blocked for >5s (salience 76)
- **Hazelcast cache contention** - threads blocked on `com.hazelcast` or `org.wso2.carbon.caching` (salience 71)
- **Severe lock contention (generic)** - fallback for any BLOCKED thread waiting on a monitor (salience 65)
- **High CPU info backstop** - threads at ≥20% CPU not surfaced by any other rule, INFO-level so the frontend's KNOWN_WSO2_THREADS classifier can flag them as benign product threads vs. application work (salience 15)

### Health Scoring

`backend/internal/analyzer/health.go#ComputeHealth` derives a deterministic 0-100 health score from the latest dump's threads (latest dump chosen by natural-sorting dump filenames, so `dump_2` sorts before `dump_10`). The score starts at 100 and subtracts named penalties: blocked-thread share (weight 50), waiting share (weight 15), timed-waiting share (weight 5), a count-based critical-risk penalty (12 per thread, capped at 45), and thread-count growth versus the previous dump (capped at 15). Each penalty over 0 is returned as a `health_factor`, and the penalties sum to `100 - health_score`. The backend is the authoritative source; the frontend renders the score and breakdown verbatim.

### Thread Pool Classification

Threads are classified into named pools via regex patterns in `backend/config/thread_pools.yaml`. Supported pools include Tomcat HTTP/HTTPS, WSO2 Synapse/PassThrough, Disruptor, RabbitMQ, MINA, DataBridge, and more. Unmatched threads fall into `"Standalone/ Ungrouped Threads"`.

### Lock Contention Analysis

The frontend derives the full lock contention graph directly from the raw thread snapshot data. The backend does not pre-process this graph. The frontend identifies lock owners (threads holding contended monitors), the blocked threads waiting on each owner, and visualizes deadlock cycles with arrow-based chain diagrams.

- `utils/lockParsing.ts` - regex extraction of held/waiting lock addresses
- `utils/lockContentionAnalysis.ts` - `deriveLockOwnerCentricData`, `detectDeadlocks`

### AI Insights

After rule analysis, the backend sends a summarized thread report (up to 40 non-INFO threads, top 3 stack frames each) to Anthropic's `claude-haiku-4-5-20251001` model. The system prompt is tailored for WSO2/Java performance engineering, instructing the model to cite specific thread names and packages. The response is structured JSON with `executive_summary`, `pattern_recognition`, and `recommended_actions`.

User-controlled fields in the prompt (issue strings, stack frames) are wrapped with `%q` via a `quoteAll` helper to prevent prompt injection from adversarial thread names or stack frames.

## License

This project is licensed under the **Apache License 2.0**. See LICENSE file for details.

```text
Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
```

All source files include the Apache 2.0 license header. You are free to use, modify, and distribute this software under the terms of the Apache License 2.0.