# TDAT Frontend

React 19 SPA for the Thread Dump Analysis Tool. Upload Java thread dumps, explore results, and visualize lock contention backed by the `tdat-backend` API.

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
Drag-and-drop upload of thread dump files and optional CPU usage metric files. Dump/usage files are paired by a normalized filename key (`utils/uploadValidation.ts#extractFileKey`) - known prefixes (`threaddump`, `threadusage`, `dump`, `usage`, `td`, `tu`, etc.) are stripped only when followed by a `_`/`-`/`.` boundary or end-of-string, so generic prefixes like `td` do not eat into unrelated names such as `today.log`. Triggers async analysis and polls for completion before navigating to the dashboard.

### Dashboard (`/dashboard`)
Summary cards (thread counts by state and risk), state distribution chart, key findings from the rule engine, thread activity heatmap, and AI-generated insights rendered as formatted markdown.

### Thread Explorer (`/thread-explorer`)
Browse all threads grouped by pool. Sort and filter by state, risk level, or name. Each row expands to show a per-snapshot timeline with stack traces, CPU %, and rule engine findings.

### Lock Contention (`/lock-contention`)
Frontend-derived lock contention graph built from thread stack trace data. Shows lock owners (threads holding contended monitors), the blocked threads waiting on each owner, contention counts per monitor address, and deadlock cycle visualizations with directional chain diagrams.

## Key Implementation Details

**Session persistence** - analysis results are stored in IndexedDB via `localforage` under key `tdat_analysis_session`. The app shows a full-screen loader until hydration completes, so the dashboard is always available after a page refresh.

**Job polling** - `useAnalyzeThreads` uses TanStack React Query's `refetchInterval` to poll `GET /api/v1/analyze/jobs/{id}` every 3 seconds. Polling stops automatically on `completed` or `failed` status.

**Lock contention** - computed entirely in the browser from raw snapshot data (`utils/lockContentionAnalysis.ts`). The backend does not pre-aggregate contention.

**Thread row keys** - `ThreadExplorer` keys each `ThreadRow` on the `{id, name, native_id, thread_pool}` composite identity used by the backend aggregator. The aggregator emits distinct histories that can share a `thread.id`, so keying on `id` alone would collide and corrupt React's reconciliation during sort/filter.

**Theme** - light/dark/system preference persisted to `localStorage` under key `tdat-theme`. Toggled via the header icon.

**Auth gate** - `AppHandler` checks Asgardeo auth state before rendering the router. Unauthenticated users see `LoginScreen`; loading state shows `PreLoader`.

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

## File Structure

```
tdat-frontend/
├── index.html                              Vite entry HTML
├── package.json                            Dependencies and scripts
├── vite.config.ts                          Vite + path-alias configuration
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json   TypeScript project refs
├── .prettierignore                         Prettier exclusion patterns
├── prettier.config.cjs                     Prettier formatting configuration
├── public/
│   ├── config.js                           Runtime API URL injection (window.configs.apiUrl)
│   ├── favicon.ico
│   └── WSO2-Pulse-Orange.png               App logo
└── src/
    ├── main.tsx                            React root — wraps App in AuthProvider
    ├── App.tsx                             Provider composition (ColorMode → QueryClient → Analysis → AppHandler)
    ├── App.css / index.css                 Global styles
    ├── theme.ts                            MUI theme factory (themeSettings(mode))
    ├── app/
    │   └── AppHandler.tsx                  Auth gate: PreLoader → LoginScreen → Router
    ├── api/
    │   └── analyze.ts                      uploadThreadDumps, getJobStatus
    ├── component/
    │   ├── common/
    │   │   └── PreLoader.tsx               Full-screen loading spinner
    │   └── ui/
    │       ├── aiMarkdown.tsx              AI markdown renderer (bold, lists, thread links)
    │       ├── LoginScreen.tsx             Asgardeo sign-in landing
    │       ├── StackTraceViewer.tsx        Stack trace code block with state chip + CPU info
    │       └── ThreadStateChip.tsx         RUNNABLE/BLOCKED/WAITING/etc. chip
    ├── config/
    │   └── authConfig.ts                   Asgardeo client config
    ├── context/
    │   ├── AnalysisContext.tsx             Session state, persisted to IndexedDB via localforage
    │   └── ColorModeContext.tsx            Light/dark theme context, persisted to localStorage
    ├── hooks/
    │   ├── useAnalyzeThreads.ts            Upload mutation + 3s polling query
    │   ├── useExportReport.ts              Generate and download text report
    │   └── useNavigateToThread.ts          Navigate to thread-explorer with search state
    ├── layout/
    │   ├── Layout.tsx                      Dashboard shell (Header + Sidebar + Outlet + Footer)
    │   ├── header/index.tsx                AppBar (logo, title, theme toggle, export, logout)
    │   ├── header/ThemeToggle.tsx          Light/dark/system theme dropdown
    │   ├── sidebar/index.tsx               Collapsible nav drawer
    │   └── footer/index.tsx                Copyright footer
    ├── pages/
    │   ├── upload/
    │   │   ├── index.tsx                   Upload page (file pairing, analyze trigger, phase backdrop)
    │   │   └── components/
    │   │       └── UploadCard.tsx          Drag-drop card with file list and validation
    │   └── dashboard/
    │       ├── DashboardHome.tsx           Layout composition for summary view
    │       ├── ThreadExplorer.tsx          Pool sidebar + sort/filter/paginate
    │       ├── LockContention.tsx          Contention page (uses lock-contention sub-components)
    │       ├── types.ts                    DashboardSummary, ThreadCluster, LongRunningThread
    │       ├── constants.ts                STATE_COLORS, STATE_ORDER, thSx
    │       ├── components/                 DashboardHome panels
    │       │   ├── SummaryCards.tsx
    │       │   ├── StateDistributionCard.tsx
    │       │   ├── KeyFindingsCard.tsx
    │       │   ├── ThreadActivityCard.tsx
    │       │   ├── AIInsightsCard.tsx
    │       │   └── ExecutiveSummaryCard.tsx
    │       ├── lock-contention/            LockContention sub-components
    │       │   ├── LockOwnerAccordion.tsx  One row per thread holding a contended monitor
    │       │   ├── MonitorSection.tsx
    │       │   ├── BlockedThreadRow.tsx    Single blocked thread with wait-time chip
    │       │   ├── LockChainView.tsx       Deadlock cycle arrow diagram
    │       │   └── OrphanedLockCard.tsx
    │       └── thread-explorer/           ThreadExplorer sub-components
    │           ├── ThreadRow.tsx           Expandable row with state chart + snapshot details
    │           ├── PoolSidebar.tsx         Left-rail pool list with select-all and per-pool toggles
    │           ├── PoolHeaderCard.tsx      Header card with pool details accordion (owns showPoolDetails state)
    │           ├── ThreadSortHeader.tsx    Column header row; exports SortableKeys / Order types
    │           └── ThreadTablePagination.tsx   Page selector + rows-per-page dropdown
    ├── utils/
    │   ├── lockParsing.ts                  Regex constants, findWaitingLock, findHeldLocks
    │   ├── lockContentionAnalysis.ts       deriveLockOwnerCentricData, detectDeadlocks
    │   ├── reportFormatter.ts              Plain-text report from AnalysisResponse
    │   └── uploadValidation.ts             validateFiles, extractFileKey (boundary-safe prefix strip), PairedFile type
    └── types/
        ├── api.ts                          JobInitResponse, JobStatusResponse, AnalysisResponse, etc.
        └── global.d.ts                     Window.configs augmentation
```

## Code Formatting

This project uses **Prettier** for consistent code formatting. Configuration is defined in `prettier.config.cjs`.

```bash
pnpm format    # (if configured) — auto-format all TypeScript/TSX files
```

## License

This project is licensed under the **Apache License 2.0**. See the main repository for the complete LICENSE file.

```
Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
Licensed under the Apache License, Version 2.0.
```

All source files (`*.tsx`, `*.ts`) include the Apache 2.0 license header at the top of the file.
