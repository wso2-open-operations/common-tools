# TDAT Backend

Go HTTP server that analyzes Java thread dumps to detect performance issues — deadlocks, high CPU usage, lock contention, thread pool saturation, and more.

## Getting Started

```bash
# Create .env with your Anthropic API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

go run main.go
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
| `thread_dumps[]` | Yes | One or more Java thread dump text files |
| `thread_usages[]` | No | Matching CPU usage files (`PID TID %CPU TIME` columns), paired by index with dumps |

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

20 Grule DSL rules in `internal/rules/rules.grl`, applied concurrently per thread. Each thread is matched by at most one rule (highest salience wins). Key detections:

| Risk | Examples |
|---|---|
| CRITICAL | Deadlock, thread starvation (>95% CPU), WSO2 PassThrough stuck on socket I/O |
| HIGH | Prolonged BLOCKED (>10s), sustained high CPU (>30%), DB wait (>5s), >25% threads blocked system-wide, HTTP worker busy (>5s), high lock contention (3+ threads on same monitor), GC activity |
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
| `ANTHROPIC_API_KEY` | Set in `.env` or environment |
| `config/thread_pools.yaml` | Thread pool name, regex patterns, description, expected behavior |
| Upload limit | 100 MB per multipart form |
| CORS | Open to all origins (`*`) |

## Building

```bash
go build -o tdat-backend    # Build binary
go mod tidy                 # Sync dependencies
```
