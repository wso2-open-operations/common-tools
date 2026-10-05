# Food Waste Dashboard

A TV dashboard that reads daily food-waste entries from a Google Sheet and
displays them as a single, always-on screen (today's totals, a weekly
breakfast/lunch trend, and monthly/annual overviews).

## Architecture

```
webapp/     React + Vite dashboard (static site) — deployed as a Choreo Web App
backend/    Go service — deployed as a Choreo Service
```

Structure follows the WSO2 internal apps convention (see
[digiops-finance](https://github.com/Delaksan-Sritharan/digiops-finance/tree/main/apps)):
a Go backend under `cmd/server` + `internal/{config,handler,middleware,sheets}`
with a `.choreo/component.yaml` and `openapi.yaml`, and a React `webapp/` with
`@component/@hooks/@config/@utils` path aliases and a runtime `public/config.js`
instead of build-time env vars.

The Google Sheet stays **private**, so the Go backend holds Google OAuth2
credentials and exposes one read-only endpoint (`GET /api/waste`) that the
webapp polls every hour (via React Query). The backend caches sheet reads for
an hour so the TV's polling doesn't hammer the Sheets API quota. There is no
database and no write path — this is a read-only display.

If the sheet is ever made public, the backend could be dropped entirely in
favor of the webapp fetching a published CSV URL directly. It's kept private
today, so the backend stays.

## One-time Google Sheets setup

The backend authenticates as a Google user (not a service account) via OAuth2,
using a refresh token obtained once through Google's OAuth Playground:

1. In Google Cloud Console, create an **OAuth client ID** (Web application
   type) and enable the **Google Sheets API**. Note the client ID and secret.
2. Go to the [OAuth Playground](https://developers.google.com/oauthplayground),
   open the gear menu, check "Use your own OAuth credentials," and paste in
   the client ID/secret from step 1.
3. In the API list, select **Google Sheets API v4**, scope
   `.../auth/spreadsheets.readonly`, and authorize with whichever Google
   account already has access to the sheet.
4. Click "Exchange authorization code for tokens" and copy the **refresh
   token** — that's the long-lived credential the backend uses (access tokens
   from this flow expire quickly; the backend renews them automatically from
   the refresh token, see `backend/internal/sheets/sheets.go`).
5. Note the spreadsheet ID (the long ID in the sheet's URL) and the sheet/tab
   name — the app expects columns in this order, one header row followed by
   data:

   `Date | Breakfast | Plates Breakfast | Lunch | Plates Lunch | Total Weight (KG) | LatestDate | Quarter`

Because this ties the integration to a specific Google account's consent
(rather than a service account), if that person's Google access is ever
revoked or the token is invalidated, the refresh token must be re-generated
via the Playground.

## Local development

**Backend**

```
cd backend
cp .env.example .env   # fill in GOOGLE_OAUTH_*, GOOGLE_SHEET_ID
make run                # or: go run ./cmd/server
make test               # go vet + go test -race ./...
```

**Webapp**

```
cd webapp
cp public/config.js.example public/config.js   # defaults to http://localhost:8080
npm install
npm run dev
```

## Deploying to Choreo

Create two components in the same Choreo project, pointed at this repo:

- **`backend/`** as a **Service** component (buildpack: Go, entry point
  `cmd/server`, listens on `$PORT`, which Choreo sets automatically).
  `.choreo/component.yaml` and `openapi.yaml` describe the component. Every
  variable in `.env.example` is required — `Load()` refuses to start if any
  are unset — so set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_RANGE`,
  `CACHE_TTL_SECONDS`, and `FRONTEND_ORIGIN` (the webapp's deployed URL) as
  component secrets/config — never commit these values.
- **`webapp/`** as a **Web Application** component (static build: `npm run
  build`, output `dist/`). Have the deployment generate `public/config.js`
  from `public/config.js.example` with `WASTE_DASHBOARD_BACKEND_BASE_URL` set
  to the backend component's public URL — this keeps the built bundle
  environment-agnostic, so the same artifact can be promoted across
  environments without a rebuild.

## Displaying on the TV

Point the TV's browser (kiosk mode / full screen) at the deployed webapp URL.
The layout is a fixed single screen — no scrolling, no manual interaction —
and refreshes its data every hour on its own. It renders correctly at
both 1080p and 4K.

## Code headers

Every source file (`.go`, `.ts`, `.tsx`, `.css`) carries a WSO2 LLC copyright
header. Keep it on new files you add.
