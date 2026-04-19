# Attack & abuse monitoring (Vercel → SIEM)

The app emits **structured JSON** security lines to stderr (`console.warn`) from `lib/security/securityLogger.ts`. Use **`logSecurityEvent(event, data, request?)`** (or the typed helpers below) — **never** `console.log` plain text for security events.

Each line includes:

| Field | Purpose |
|--------|--------|
| `service` | Always `nbe-portal` |
| `env` | `VERCEL_ENV` or `NODE_ENV` |
| `schema` / `schema_version` | Stable parsing (`nbe.security` / `1`) |
| `request_id` | `x-vercel-id`, `x-request-id`, or `cf-ray` when present |
| `event` | e.g. `rate_limit_exceeded`, `api_auth_failure`, `bot_blocked`, `session_required` |
| `monitoring.signal` | **Use for alerts**: `rate_limit_429`, `bot_block`, `api_unauthorized_401`, `api_forbidden_403`, `session_required_redirect` |
| `http_status_code` | When applicable (400, 401, 403, 429, 307) |
| `path`, `method`, `ip` (masked), `userId` (optional UUID when known), `tier`, `detail`, `reason`, `labels` | Context — **no tokens or passwords** |
| `timestamp` | ISO-8601 |

## What is logged today

- **429 / rate limits** — Middleware: `event: rate_limit_exceeded`, `monitoring.signal: rate_limit_429`.
- **Bot / bad clients** — Missing User-Agent: `bot_blocked`, `monitoring.signal: bot_block`.
- **401 / 403 (manager reports API)** — `requireManagerReportsApi(supabase, request)` logs `api_unauthorized_401` / `api_forbidden_403` with path + redacted IP.
- **Session required (optional)** — Set `SECURITY_LOG_SESSION_REDIRECTS=1` on Vercel to log unauthenticated hits to protected **HTML** routes (`session_required`, `session_required_redirect`). **High volume** — enable when tuning anomaly rules.

## Vercel → log drain

1. **Vercel** → Project → **Settings** → **Log Drains** (Team Pro / Enterprise) or use **Vercel’s Observability** integration.
2. Add your provider’s HTTP endpoint or use **OpenTelemetry** if supported.

### Logflare (example)

- Create a Logflare source; use the ingest URL / API key Vercel provides in the Logflare integration, or forward generic HTTPS drains to Logflare’s endpoint.
- Parse JSON: filter on `schema":"nbe.security"` or `service":"nbe-portal"`.

### Datadog (example)

- Install **Datadog Vercel integration** or configure a **log drain** to Datadog Logs.
- Create facets on `monitoring.signal`, `http_status_code`, `path`, `ip`.
- **Monitors (examples)**:
  - **429 spike**: `monitoring.signal:rate_limit_429` count over 5m > baseline.
  - **401 spike**: `monitoring.signal:api_unauthorized_401` count over 5m > threshold.
  - **Unusual IP**: cardinality or count grouped by `ip` on `rate_limit_429` + `bot_block`.

### Sentry (errors + security signals)

The app includes **`@sentry/nextjs`** with:

| File | Role |
|------|------|
| `sentry.client.config.ts` | Browser SDK (`NEXT_PUBLIC_SENTRY_DSN` or `SENTRY_DSN`) |
| `sentry.server.config.ts` | Node (API routes, RSC) |
| `sentry.edge.config.ts` | Edge (middleware) |
| `instrumentation.ts` | Loads server + edge configs; `onRequestError` for server failures |
| `instrumentation-client.ts` | Loads client Sentry config (router transition hook disabled — caused Next.js router errors in dev) |

**DSN:** set `SENTRY_DSN` on the server; for the browser set **`NEXT_PUBLIC_SENTRY_DSN`** to the same DSN string so the client SDK can send events (the DSN is public in the bundle by design).

**Security events:** `lib/security/securityLogger.ts` mirrors selected events to Sentry via `lib/security/securitySentry.ts` (`captureMessage`, level `warning`, tags `security_event`, `monitoring_signal`). Disable mirroring only with `SENTRY_SECURITY_EVENTS=0` (JSON logs unchanged).

**Alerts in Sentry:** create issues or metric alerts filtered by tag `security_event` (e.g. `rate_limit_exceeded`, `api_auth_failure`, `bot_blocked`, `invalid_payload`).

**CSP:** `lib/security/csp.ts` allows `connect-src` to `*.ingest.*.sentry.io` so the browser can report without CSP violations.

Optional: add `SENTRY_AUTH_TOKEN` + org/project in CI and enable source maps in `next.config.ts` (`withSentryConfig`) for readable stack traces.

## Environment variables

| Variable | Effect |
|----------|--------|
| `SENTRY_DSN` | Server/Edge Sentry DSN (also used as fallback if client DSN unset in some builds) |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser Sentry DSN (recommended for client) |
| `SENTRY_SECURITY_EVENTS=0` | Stop sending security `captureMessage` events to Sentry (stdout JSON logs continue) |
| `SECURITY_LOG_SESSION_REDIRECTS=1` | Log protected-route redirects to login (HTML), for IP / path scanning analysis. |
| `NEXT_PUBLIC_APP_SESSION_EPOCH` | Optional string (e.g. `2026-04-14b`). When changed and redeployed, browsers clear local Supabase session once so **all users must sign in again** (stored in `localStorage` key `nbe_app_session_epoch`). |
| `NEXT_PUBLIC_IDLE_TIMEOUT_MS` | Idle limit in ms (default 15 minutes). Set to `0` to disable idle logout + warning. |
| `NEXT_PUBLIC_SESSION_MAX_MS` | Absolute max session length from login time in `sessionStorage` (`nbe_login_at`, default 8 hours). Set to `0` to disable. |
| `NEXT_PUBLIC_IDLE_WARNING_BEFORE_MS` | How long before idle expiry to show the “Stay signed in” modal (default 2 minutes). |
| `NEXT_PUBLIC_IDLE_TRACK_MOUSEMOVE` | Set to `0` or `false` to stop counting throttled mousemove as activity (clicks/keys/routes still count). |

## Query examples (Datadog / generic)

- Count 429s: `@monitoring.signal:rate_limit_429`
- Count API 401s: `@monitoring.signal:api_unauthorized_401`
- Top paths on rate limit: group by `path` where `event:rate_limit_exceeded`

After enabling drains, run a **smoke test** (login, hit a manager report, trigger rate limit in staging) and confirm lines appear with expected `monitoring.signal` values.
