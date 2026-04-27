# TDAT Frontend

React 19 SPA for the Thread Dump Analysis Tool. Upload Java thread dumps, explore results, and visualize lock contention — backed by the `tdat-backend` API.

## Getting Started

```bash
# Copy and fill in Asgardeo auth config
cp .env.example .env.local
# Edit .env.local: set VITE_ASGARDEO_CLIENT_ID and VITE_ASGARDEO_BASE_URL

pnpm install
pnpm dev
```

Set the backend URL in `public/config.js`:
```js
window.configs = { apiUrl: "http://localhost:8080" };
```

## Commands

```bash
pnpm dev        # Start dev server
pnpm build      # Type-check + production build (tsc -b && vite build)
pnpm lint       # ESLint
pnpm preview    # Preview production build
```

## Configuration

| Variable | Where | Description |
|---|---|---|
| `VITE_ASGARDEO_CLIENT_ID` | `.env.local` | Asgardeo application client ID |
| `VITE_ASGARDEO_BASE_URL` | `.env.local` | Asgardeo tenant base URL |
| `window.configs.apiUrl` | `public/config.js` | Backend API base URL (runtime-injected) |

## Pages

### Upload (`/`)
Drag-and-drop upload of thread dump files and optional CPU usage metric files. Files are paired by index (dump[0] ↔ usage[0]). Triggers async analysis and polls for completion before navigating to the dashboard.

### Dashboard (`/dashboard`)
Summary cards (thread counts by state and risk), state distribution chart, key findings from the rule engine, thread activity heatmap, and AI-generated insights rendered as formatted markdown.

### Thread Explorer (`/thread-explorer`)
Browse all threads grouped by pool. Sort and filter by state, risk level, or name. Each row expands to show a per-snapshot timeline with stack traces, CPU %, and rule engine findings.

### Lock Contention (`/lock-contention`)
Frontend-derived lock contention graph built from thread stack trace data. Shows culprit threads (holding locks), victim threads (waiting), contention counts per monitor address, and deadlock cycle visualizations with directional chain diagrams.

## Key Implementation Details

**Session persistence** — analysis results are stored in IndexedDB via `localforage` under key `tdat_analysis_session`. The app shows a full-screen loader until hydration completes, so the dashboard is always available after a page refresh.

**Job polling** — `useAnalyzeThreads` uses TanStack React Query's `refetchInterval` to poll `GET /api/v1/analyze/jobs/{id}` every 3 seconds. Polling stops automatically on `completed` or `failed` status.

**Lock contention** — computed entirely in the browser from raw snapshot data (`utils/lockContentionAnalysis.ts`). The backend does not pre-aggregate contention.

**Theme** — light/dark/system preference persisted to `localStorage` under key `tdat-theme`. Toggled via the header icon.

**Auth gate** — `AppHandler` checks Asgardeo auth state before rendering the router. Unauthenticated users see `LoginScreen`; loading state shows `PreLoader`.

## Stack

| Library | Purpose |
|---|---|
| React 19 | UI framework |
| MUI v7 | Component library and theming |
| TanStack React Query v5 | Server state, mutation, and polling |
| `@asgardeo/auth-react` | Authentication |
| `localforage` | IndexedDB-backed session persistence |
| `react-router-dom` v7 | Client-side routing |
| Vite 7 | Build tool and dev server |
