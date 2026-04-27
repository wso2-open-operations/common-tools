# Thread Dump Analysis Tool (TDAT)

A full-stack tool for analyzing Java thread dumps to detect performance issues — deadlocks, high CPU usage, lock contention, thread pool saturation, and more.

## Overview

Upload one or more Java thread dump files (and optionally CPU usage metrics) and get:

- Per-thread risk classification (CRITICAL / HIGH / MEDIUM / INFO) via a Grule rule engine
- Thread pool identification (Tomcat, WSO2, Disruptor, RabbitMQ, MINA, etc.)
- Lock contention graph with culprit/victim relationships and deadlock cycle detection
- Chronological thread history when multiple dumps are uploaded
- AI-generated executive summary, pattern recognition, and recommended actions (via Anthropic Claude)

## Projects

| Directory | Stack | Description |
|---|---|---|
| `tdat-backend/` | Go | HTTP API server — parses dumps, runs Grule rules, calls Anthropic AI |
| `tdat-frontend/` | React 19 + TypeScript + Vite | SPA — upload, dashboard, thread explorer, lock contention view |

## Getting Started

### Backend

```bash
cd tdat-backend
# Create .env with your Anthropic API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

go run main.go
# Server starts at http://localhost:8080
```

If `ANTHROPIC_API_KEY` is not set, the server still runs and analysis completes — AI insights will return a static "unavailable" message instead of an error.

### Frontend

```bash
cd tdat-frontend
# Copy and fill in Asgardeo auth config
cp .env.example .env.local
# Edit .env.local: set VITE_ASGARDEO_CLIENT_ID and VITE_ASGARDEO_BASE_URL

pnpm install
pnpm dev
```

The frontend reads the backend URL from `public/config.js` at runtime via `window.configs.apiUrl`. For local development, update that file to point to `http://localhost:8080`.

## API

```
POST /api/v1/analyze/jobs          # Upload files → returns { job_id } (202 Accepted)
GET  /api/v1/analyze/jobs/{id}     # Poll for result → { status, result }
GET  /health                        # Liveness probe
GET  /                              # HTML upload form for manual testing
```

The analysis runs asynchronously. Poll the status endpoint until `status` is `completed` or `failed`.

**Upload fields (multipart/form-data):**
- `thread_dumps[]` — required, one or more Java thread dump `.txt`/`.log` files
- `thread_usages[]` — optional, matching CPU usage files (`PID TID %CPU TIME` columns)

When multiple dump files are uploaded, TDAT correlates threads across snapshots by identity (`name + id + native_id + pool`) to show how thread state evolved over time.

**Result shape:**
```json
{
  "session_id": "uuid",
  "timestamp": "RFC3339",
  "threads": [ ...AnalyzedThread ],
  "thread_pools": { "Pool Name": { "description": "...", "expected_behavior": "..." } },
  "ai_insights": { "executive_summary": "...", "pattern_recognition": "...", "recommended_actions": "..." },
  "errors": []
}
```

## Features

### Rule Engine (20 rules)

Rules are defined in `tdat-backend/internal/rules/rules.grl` using the Grule DSL. Each thread is matched by the highest-salience rule that fires, then marked as analyzed so no second rule re-fires on it. Key rules:

- **Deadlock detection** — threads flagged in the JVM deadlock summary section (salience 100)
- **WSO2 I/O stuck** — PassThrough threads with RUNNABLE state but 0% CPU stuck on socket I/O (salience 95)
- **Thread starvation** — single thread consuming >95% CPU (salience 86)
- **High global blockage** — >25% of all threads BLOCKED system-wide (salience 88)
- **High CPU** — RUNNABLE threads with >30% CPU usage (salience 80)
- **Database waits** — threads in JDBC/Hibernate calls for >5s (salience 85)
- **Lock contention** — 3+ threads waiting on the same monitor address (salience 83)
- **HTTP bottleneck** — Tomcat HTTP/HTTPS workers busy or blocked for >5s (salience 76)
- **GC detection** — threads waiting in GC-related stack frames (salience 85)

### Thread Pool Classification

Threads are classified into named pools via regex patterns in `tdat-backend/config/thread_pools.yaml`. Supported pools include Tomcat HTTP/HTTPS, WSO2 Synapse/PassThrough, Disruptor, RabbitMQ, MINA, DataBridge, and more. Unmatched threads fall into `"Standalone/ Ungrouped Threads"`.

### Lock Contention Analysis

The frontend derives the full lock contention graph from raw thread snapshot data — no pre-processing by the backend. It identifies culprit threads (holding locks), victim threads (waiting), and visualizes deadlock cycles with arrow-based chain diagrams.

- `utils/lockParsing.ts` — regex extraction of held/waiting lock addresses
- `utils/lockContentionAnalysis.ts` — culprit-centric aggregation and deadlock cycle detection

### AI Insights

After rule analysis, the backend sends a summarized thread report (up to 40 non-INFO threads, top 3 stack frames each) to Anthropic's `claude-haiku-4-5-20251001` model. The system prompt is tailored for WSO2/Java performance engineering, instructing the model to cite specific thread names and packages. The response is structured JSON with `executive_summary`, `pattern_recognition`, and `recommended_actions`.
