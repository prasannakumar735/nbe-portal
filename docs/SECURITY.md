# Security posture — NBE Portal

This document summarizes the threat model, findings from the codebase review, implemented controls, and a production checklist. It is not a substitute for a full penetration test.

- **Backup & recovery (Supabase):** `docs/BACKUP_RECOVERY.md` · checklist: `docs/SUPABASE_BACKUP_RECOVERY.md` · verify connectivity: `npm run backup:check`
- **Smoke security requests:** `npm run security:pen-test` (see `scripts/security-pen-test.mjs`)
- **Automated security scenarios (TypeScript):** `npm run security:test` — runs `scripts/security-tests.ts` against `BASE_URL` (default `http://localhost:3000`). Start the app first. Expect `[PASS] / [FAIL] / [SKIP]` lines. Requests send **`x-nbe-security-test: harness`** so you can **filter access / edge logs** for these runs. Failures and rate limits emit normal **structured security logs** (`lib/security/securityLogger.ts`) and Sentry signals where configured.

## 1. Architecture (trust boundaries)

| Layer | Responsibility |
|--------|----------------|
| **Browser** | Untrusted; never store secrets; Supabase session in httpOnly cookies (Supabase SSR). |
| **Next.js middleware** | Distributed rate limits (Upstash Redis when configured) on **all** `/api/*`; portal route protection via Supabase session + `profiles`. |
| **Route handlers** | Sensitive operations use **service role** only on the server; validate inputs; generic errors in production (`lib/security/safeApiError.ts`). |
| **Supabase** | PostgreSQL with RLS on app tables; **JWT validated** by PostgREST; **service role bypasses RLS** — use only in trusted server code. |

## 2. Findings (prioritized)

### High / medium

| Issue | Status | Notes |
|--------|--------|--------|
| **Distributed rate limiting** | **Implemented** when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set (`lib/security/rateLimitDistributed.ts`). Falls back to in-memory windows per isolate if unset. |
| **RLS coverage** | Ongoing | Many tables have policies under `lib/db/migrations/*.sql` (profiles, timesheets, calendar, job cards, etc.). **Service-role routes** must enforce authorization in code — RLS does not apply the same way. |
| **`password_reset_tokens`** | Mitigated | RLS disabled + server-only access in migration `053_password_reset_tokens_access.sql`; tokens not exposed to anon clients. |
| **CSP** | **Hardened (prod)** | Nonce + `strict-dynamic` in `middleware.ts` (`lib/security/csp.ts`); dev retains `unsafe-eval` (scripts) and `unsafe-inline` (styles) per Next.js guidance. See `docs/CSP_NOTES.md`. |
| **CSRF** | Browser-default | Same-site cookies + same-origin API usage reduce CSRF for cookie-based auth. **State-changing** routes that accept cookies should remain POST + JSON; avoid GET mutations. |
| **Error leakage** | Mitigated | `jsonError500` hides internals in production. |

### Lower / informational

| Issue | Notes |
|--------|--------|
| **SQL injection** | App uses Supabase client (parameterized). One `rpc('process_inventory_order', …)` — ensure the DB function uses typed args only. |
| **XSS** | Prefer React text nodes; `dangerouslySetInnerHTML` usage is minimal — audit any HTML email/PDF builders. |
| **Secrets** | Never prefix server secrets with `NEXT_PUBLIC_`. Rotate keys if exposed in logs or screenshots. |

## 3. Implemented controls (current)

- **`lib/security/rateLimitDistributed.ts`** — `@upstash/ratelimit` + `@upstash/redis`; tiers: **auth 10/min**, **sensitive 30/min**, **general 60/min** (`lib/security/apiPathTiers.ts`). Fallback: `rateLimitEdge` in-memory.
- **`middleware.ts`** — matcher `/api/:path*`; **Retry-After** on 429; structured **`securityLogger`**; optional **missing User-Agent** block (`RELAX_BOT_CHECKS=1` disables).
- **`lib/security/errors.ts`** — `UnauthorizedError`, `ForbiddenError` for API routes.
- **`lib/security/requireUser.ts`** — `requireUser(supabase)` after `createServerClient()` for JWT validation before service-role work (re-exports `UnauthorizedError`).
- **`lib/security/requireRole.ts`** — `requireRole(profile, roles)` using **`profiles.role` from the DB**, never from the request body.
- **`lib/security/requireUserProfile.ts`** — `requireUser` + `profiles` row for ownership / role checks.
- **`lib/security/requirePortalStaff.ts`** — authenticated internal staff (excludes `client`); used before service-role quote APIs.
- **`lib/security/httpAuthErrors.ts`** — map `UnauthorizedError` / `ForbiddenError` to 401/403 JSON.
- **`lib/security/publicContactSlug.ts`** — slug validation for **public** contact/vCard/business-card routes (no session; service role used only after shape validation).
- **`lib/security/securityLogger.ts`** — Central **`logSecurityEvent(event, data, request?)`** emits one JSON line per event (`event`, masked `ip`, `path`, `method`, optional `userId`, `timestamp`, …); helpers `securityLog` / `securityLogApiUnauthorized` / `securityLogApiForbidden` / `securityLogInvalidPayload`. **`lib/security/securitySentry.ts`** mirrors key events to **Sentry** when DSN is set. See **`docs/MONITORING.md`**.
- **`@sentry/nextjs`** — `sentry.*.config.ts`, `instrumentation.ts`, `instrumentation-client.ts`, `app/global-error.tsx`; `next.config.ts` wrapped with `withSentryConfig`.
- **`lib/security/httpRequestLimits.ts`** — `Content-Length` guard for JSON APIs.
- **`lib/security/schemas/authSchemas.ts`** — Zod schemas for auth bodies.
- **Auth routes** — size limits + Zod on forgot/reset flows.
- **`middleware.ts` + `lib/security/csp.ts`** — per-request **CSP** (nonces; no duplicate CSP in `next.config.ts`).
- **`next.config.ts`** — security headers (no CSP here); **HSTS** `max-age=63072000; includeSubDomains; preload` when eligible (see **`docs/HSTS.md`** — validation, pre-deploy checks, rollback), `productionBrowserSourceMaps: false`.

### Temporary IP ban (abuse protection)

When Upstash Redis env vars are set, failure counters and bans are **distributed**. Otherwise an **in-memory** fallback applies per runtime isolate (e.g. local dev).

- **Keys:** `ip:failures:{ip}`, `ip:ban:{ip}` (see `lib/security/ipBlocker.ts`).
- **Rule:** **10** failed outcomes → **10 minutes** ban (`Retry-After: 600` when blocking `/api`).
- **Increments:** `securityLogApiUnauthorized` / `securityLogApiForbidden`, rate-limit **429** in middleware, failed **`/api/auth/login`**.
- **Reset:** successful **`/api/auth/login`** clears the counter and ban for that IP.

### Cloudflare Turnstile (optional, recommended for production)

The widget uses `next/script` with the **same CSP nonce** as middleware (`x-nonce` → `script` `nonce` attribute). With `script-src` **`strict-dynamic`**, host allowlists do not authorize external scripts; the nonce is required. It loads `https://challenges.cloudflare.com/turnstile/v0/api.js` and an implicit-render `div` with class `cf-turnstile` and `data-sitekey` (`components/security/TurnstileWidget.tsx`).

Set **both** on Vercel (free tier):

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — site key (widget on `/login` and `/forgot-password`)
- `TURNSTILE_SECRET_KEY` — secret (server verification; never public)

If either is missing, CAPTCHA is **not** enforced (local dev friendly). See [Turnstile docs](https://developers.cloudflare.com/turnstile/).

### Environment: Upstash (production)

Set on Vercel:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Performance

- Upstash adds ~1–5 ms typical latency per rate-limit check (HTTP to Redis). Acceptable for API middleware; monitor p95 after rollout.

### Secured route pattern (JWT + service role)

1. `const supabase = await createServerClient()`
2. `const user = await requireUser(supabase)` (or `requireUserProfile` / `requirePortalStaff` / `requireManagerOrAdminApi` as appropriate)
3. Authorize resource ownership (`resource.user_id === user.id`, etc.) or role via **`requireRole`** / `profiles.role` **before** calling `createServiceRoleClient()`.

Examples: `app/api/notifications/timesheet-submitted/route.ts` (ownership), `app/api/quotes/service/route.ts` (`requirePortalStaff` + service role for inserts).

## 4. Secure API route pattern (example)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { assertJsonContentLength, PayloadTooLargeError } from '@/lib/security/httpRequestLimits'
import { jsonError500 } from '@/lib/security/safeApiError'

const bodySchema = z.object({ id: z.string().uuid() })

export async function POST(request: NextRequest) {
  try {
    assertJsonContentLength(request, 32_768)
    const json = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    const supabase = await createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    // … authorized work using user.id — never trust client-supplied user id alone …
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
    }
    return jsonError500(e, 'my-route')
  }
}
```

## 5. Supabase RLS — reference patterns

Existing migrations define policies; patterns include:

- **Own row**: `USING (auth.uid() = user_id)` (or `profiles.id`).
- **Role elevation**: see `024_profiles_rbac.sql`, `031_profiles_rls_elevation_table.sql`, `032_profiles_rls_force_single_select_policy.sql`.
- **Manager read scope**: e.g. `023_timesheet_rejected_and_manager_rls.sql`, `038_manager_read_clients_client_locations.sql`.

**New tables** should:

```sql
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "my_table_select_own"
  ON public.my_table FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- Add INSERT/UPDATE/DELETE with least privilege; test as each role in SQL editor.
```

Avoid `USING (true)` for `authenticated` on sensitive data.

## 6. Middleware (auth guard) — current behavior

- **Portal routes** in `middleware.ts` `matcher` require a valid Supabase user + `profiles` row + active account; clients redirected to `/client`.
- **API routes** are **not** globally authenticated by this middleware — each handler must call `getUser()` or use service role with explicit checks.

## 7. Production checklist

- [ ] **Vercel env**: `NEXT_PUBLIC_*` only for public config; **service role** and Graph secrets **server-only**.
- [ ] **Supabase**: RLS enabled on all public tables; no broad `anon` write policies without review.
- [ ] **HTTPS**: HSTS is set in production via `next.config.ts` (`max-age=63072000; includeSubDomains; preload`). Verify HTTPS everywhere before first deploy.
- [ ] **Distributed rate limiting** for `/api/auth/*` and high-risk routes (Upstash/KV).
- [ ] **Logging**: ship `console` to a log drain; **no PII/passwords** in logs; alert on 401/429 spikes.
- [ ] **Dependency audit**: `npm audit`, Dependabot.
- [ ] **CSP**: monitor browser console for violations after deploy; add third-party origins to `lib/security/csp.ts` when introducing new scripts.
- [ ] **Optional**: Web Application Firewall (WAF), bot management, CAPTCHA on forgot-password if abused.

## 8. Security testing suggestions

- **Auth**: expired JWT, tampered cookie, cross-user `id` in API bodies — expect 401/403.
- **Injection**: long strings, SQL keywords in form fields — Supabase should parameterize; app should reject oversize payloads.
- **XSS**: stored payloads in profile fields — ensure React escaping and no unsafe HTML render.

---

*Last updated with codebase hardening pass (rate limits, headers, auth validation).*
