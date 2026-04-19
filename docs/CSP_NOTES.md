# Content-Security-Policy notes

## Current posture (nonce-based)

- **Source of truth:** `middleware.ts` + `lib/security/csp.ts`.
- Each HTML/API request gets a fresh **`x-nonce`** header and a **`Content-Security-Policy`** header with:
  - **`script-src`**: `'self' 'nonce-{nonce}' 'strict-dynamic'` — production has **no** `'unsafe-inline'` / `'unsafe-eval'`.
  - **`style-src`**: production uses **`'nonce-{nonce}'`** plus `https://fonts.googleapis.com` (Material / Roboto stylesheets). Development keeps **`'unsafe-inline'`** on styles so React/Tailwind iteration stays smooth.
- **Development** still adds **`'unsafe-eval'`** on `script-src` (React dev tooling / stack traces per [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy)).
- **`connect-src`**: Supabase, Microsoft Graph, Nominatim, Google Maps APIs.
- **`worker-src 'self' blob:`** — service workers / workers.
- **Production only:** `upgrade-insecure-requests`.

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
