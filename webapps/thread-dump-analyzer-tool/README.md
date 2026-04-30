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

### Rule Engine (28 rules)

Rules are defined in `tdat-backend/internal/rules/rules.grl` using the Grule DSL. Each thread is matched by the highest-salience rule that fires, then marked as analyzed so no second rule re-fires on it (no `Retract()` is used — gating on `Analyzed` avoids working-memory thrashing). Two unambiguous findings — JVM-reported deadlocks and runaway threads at ≥100% CPU — are pre-flagged directly by the parser before rules run. Key rules:

- **Deadlock detection** — threads flagged in the JVM deadlock summary section (salience 100; parser pre-flags as CRITICAL)
- **PassThrough starvation** — `PassThroughMessageProcessor-` threads blocked on backend I/O via NIO reactor or socket read (salience 96)
- **WSO2 I/O stuck** — PassThrough threads RUNNABLE with 0% CPU stuck on socket I/O (salience 95)
- **DB connection pool exhaustion** — threads parked in `ConnectionPool.borrowConnection` (salience 92)
- **High global blockage** — >25% of all threads BLOCKED system-wide (salience 88)
- **Thread starvation** — single thread consuming >95% CPU (salience 86; parser pre-flags ≥100% as runaway)
- **Database waits** — threads in JDBC/Hibernate calls for >5s (salience 85)
- **GC detection** — threads waiting in GC-related stack frames (salience 85)
- **Critical lock contention** — 20+ threads queued on the same monitor address; at this scale the protected operation is fully serialized and represents a transport-level throughput failure (salience 84; CRITICAL)
- **High lock contention** — 3+ threads waiting on the same monitor address (salience 83)
- **Catastrophic thread count** — RUNNABLE native/socket threads in a JVM with 5,000+ live threads; each thread is a GC root and at this scale the GC must scan tens of thousands of stacks on every collection cycle, causing high CPU even though individual threads are idle — a classic thread leak signature (salience 82; CRITICAL)
- **High CPU** — RUNNABLE threads with >30% CPU usage (salience 80)
- **LDAP / user store timeouts** — threads in `javax.naming` / `com.sun.jndi.ldap` / WSO2 LDAP user store (salience 78)
- **OAuth2 token bottleneck** — BLOCKED/WAITING in `org.wso2.carbon.identity.oauth2` (salience 77)
- **HTTP bottleneck** — Tomcat HTTP/HTTPS workers busy or blocked for >5s (salience 76)
- **Hazelcast cache contention** — threads blocked on `com.hazelcast` or `org.wso2.carbon.caching` (salience 71)
- **Severe lock contention (generic)** — fallback for any BLOCKED thread waiting on a monitor (salience 65)

### Thread Pool Classification

Threads are classified into named pools via regex patterns in `tdat-backend/config/thread_pools.yaml`. Supported pools include Tomcat HTTP/HTTPS, WSO2 Synapse/PassThrough, Disruptor, RabbitMQ, MINA, DataBridge, and more. Unmatched threads fall into `"Standalone/ Ungrouped Threads"`.

### Lock Contention Analysis

The frontend derives the full lock contention graph from raw thread snapshot data — no pre-processing by the backend. It identifies culprit threads (holding locks), victim threads (waiting), and visualizes deadlock cycles with arrow-based chain diagrams.

- `utils/lockParsing.ts` — regex extraction of held/waiting lock addresses
- `utils/lockContentionAnalysis.ts` — culprit-centric aggregation and deadlock cycle detection

### AI Insights

After rule analysis, the backend sends a summarized thread report (up to 40 non-INFO threads, top 3 stack frames each) to Anthropic's `claude-haiku-4-5-20251001` model. The system prompt is tailored for WSO2/Java performance engineering, instructing the model to cite specific thread names and packages. The response is structured JSON with `executive_summary`, `pattern_recognition`, and `recommended_actions`.

## License

This project is licensed under the **Apache License 2.0**. See LICENSE file for details.

```
Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
```

All source files include the Apache 2.0 license header. You are free to use, modify, and distribute this software under the terms of the Apache License 2.0.
