# Content-Security-Policy notes

## Current posture (nonce-based)

- **Source of truth:** `middleware.ts` + `lib/security/csp.ts`.
- Each HTML/API request gets a fresh **`x-nonce`** header and a **`Content-Security-Policy`** header with:
  - **`script-src`**: `'self' 'nonce-{nonce}' 'strict-dynamic'` — production has **no** `'unsafe-inline'` / `'unsafe-eval'`.
  - **`style-src`**: production uses **`'nonce-{nonce}'`**, **`'unsafe-inline'`** (for Recharts / other libs that inject `<style>` nodes — **scripts** remain strict), and `https://fonts.googleapis.com` where needed. Roboto stays under `/public/fonts`; **Material Symbols** is bundled via **`@fontsource-variable/material-symbols-outlined`** (no fragile `fonts.gstatic.com` version URLs). **`style-src-attr 'unsafe-inline'`** still allows `style=""` on elements. Development keeps **`'unsafe-inline'`** on styles so React/Tailwind iteration stays smooth.
- **Development** still adds **`'unsafe-eval'`** on `script-src` (React dev tooling / stack traces per [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy)).
- **`connect-src`**: `'self'`, Turnstile (`https://challenges.cloudflare.com`), Supabase, Microsoft Graph, Nominatim, Google Maps, Sentry ingest.
- **`worker-src`**: `'self'`, `blob:`, and **`https://challenges.cloudflare.com`** (Turnstile workers) — not only `blob:`.
- **Production only:** `upgrade-insecure-requests`.
- **Turnstile:** `script-src` includes `'strict-dynamic'`, so listing `https://challenges.cloudflare.com` alone does **not** authorize `api.js` — pass middleware **`x-nonce`** into `next/script` as the `nonce` attribute (`components/security/TurnstileWidget.tsx`, login + forgot-password pages). `worker-src` allows the same host for challenge workers.

## Why `unsafe-inline` / `unsafe-eval` were removed (production)

Previously, `next.config.ts` used permissive `script-src` / `style-src` so hydration always worked without per-request nonces. That is now replaced by middleware nonces + `strict-dynamic` for scripts; inline **API-generated** HTML (e.g. print export) must add matching `nonce` attributes — see `app/api/manager/reports/export/print/route.ts`.

## Root layout

- `export const dynamic = 'force-dynamic'` and `await headers()` in `app/layout.tsx` so RSC output aligns with the per-request CSP.

## What to watch

- Browser console **CSP violations** after deploy (especially third-party scripts).
- **Prefetch**: matcher skips `next-router-prefetch` / `purpose: prefetch` per Next.js recommendation.
- **New inline scripts/styles**: add `nonce` from `headers().get('x-nonce')` or avoid inline content.

## After changes

Run `npm run build` and smoke-test: login, maintenance flows, PDFs, maps/geocode, Microsoft Graph mail, **manager reports print** (`/api/manager/reports/export/print`).

## Nonce flow (App Router)

1. **`middleware.ts`** — Each request: `generateCspNonce()` → set **`x-nonce`** on the forwarded request and emit **`Content-Security-Policy`** via `buildContentSecurityPolicy(nonce)` (`lib/security/csp.ts`). **Do not remove** the nonce.
2. **Pages with Turnstile** — Server Components read **`(await headers()).get('x-nonce')`** and pass it to the client as **`cspNonce`** → **`TurnstileWidget`** **`scriptNonce`** → **`<Script nonce={...} />`**. Same nonce as in the CSP header.
3. **Inline scripts elsewhere** — e.g. manager print HTML uses the same nonce on `<style>` / `<script>` when present (`app/api/manager/reports/export/print/route.ts`).

## Turnstile script integration

`components/security/TurnstileWidget.tsx` uses `next/script` with **`strategy="afterInteractive"`**, **`async`**, **`defer`**, and **`nonce={scriptNonce}`** (required when `script-src` includes **`strict-dynamic`**).

## Post-deploy verification checklist

- [ ] **Console:** No CSP violations for `script-src` / `frame-src` / `connect-src` on `/login` and `/forgot-password` (with Turnstile env vars set).
- [ ] **Network:** `turnstile/v0/api.js` loads **200**; challenge iframe requests to `challenges.cloudflare.com` not blocked.
- [ ] **UI:** Turnstile completes (e.g. success / checkbox) — no partial widget.
- [ ] **Regression:** Manager reports print still renders; other flows that need `connect-src` (Supabase, maps, Graph) still work.

## `next.config.ts`

**No** CSP header is set in `next.config.ts` (avoids conflicting with middleware). Security headers there are HSTS, frame options, etc. — see file comments.
