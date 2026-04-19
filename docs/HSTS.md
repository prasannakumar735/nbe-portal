# HTTP Strict Transport Security (HSTS)

Operational guide for the NBE Portal Next.js app on **Vercel**: configuration validation, safe rollout, verification, and rollback awareness.

## 1. Validation report — current configuration

**Source of truth:** `next.config.ts` (wrapped by `withSentryConfig`; headers are preserved).

| Requirement | Expected | Current | Status |
|---------------|----------|---------|--------|
| Header name | `Strict-Transport-Security` | Same | OK |
| `max-age` | ≥ 1 year (often 2 years for preload) | `63072000` seconds (**730 days**, ~2 years) | OK |
| `includeSubDomains` | Present only if **every** subdomain is HTTPS-only | Present | OK — **see subdomain caveat below** |
| `preload` | Optional; use only if eligible for [hstspreload.org](https://hstspreload.org/) | Present | OK — **see preload caveat below** |
| Non-production | No HSTS on dev / Vercel preview | Gated: `NODE_ENV === 'production'` **and** (`VERCEL_ENV` unset **or** `VERCEL_ENV === 'production'`) | OK |

**Exact header value (when eligible):**

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

### Caveats (production-grade)

1. **`includeSubDomains`** — Browsers will refuse plain HTTP for **any** host under the registrable domain (e.g. `*.example.com`). Ensure no legacy `http://`-only subdomains (old APIs, marketing sites, file hosts) before long `max-age` + preload.
2. **`preload`** — Submitting the domain to the Chrome preload list is **irreversible** until expiry and requires meeting [preload requirements](https://hstspreload.org/). Coordinate with whoever owns DNS and all subdomains.
3. **Vercel preview** — Preview deployments use `NODE_ENV=production` but **`VERCEL_ENV=preview`**, so this project **does not** send HSTS on preview URLs (avoids pinning ephemeral `*.vercel.app` hosts with `preload`).

## 2. Pre-deployment safety checks

Complete before raising `max-age` / enabling preload on a new apex domain.

### 2.1 HTTPS coverage

- [ ] Production apex and `www` (if used) load over **HTTPS** with a valid certificate.
- [ ] Every **subdomain** you intend to keep under the same site (API, assets, staging on a separate hostname, etc.) supports **HTTPS** if `includeSubDomains` is in effect.

Vercel terminates TLS; confirm custom domains show **Valid** in the Vercel project.

### 2.2 Mixed content (browser)

- [ ] No `http://` scripts, styles, iframes, or active content on production pages.
- [ ] Images/APIs: prefer `https://` or scheme-relative where appropriate.

**Repo scan (maintenance):** Production URL construction uses `publicAppBaseUrl()` (`lib/app/publicAppBaseUrl.ts`), which prefers `NEXT_PUBLIC_APP_URL`, then `https://` + `VERCEL_URL`, then `http://localhost:3000` for local dev only. **Set `NEXT_PUBLIC_APP_URL` to an `https://` URL in Vercel production** so emails/PDFs/QRs never emit `http://` links.

**CSP:** Production CSP includes `upgrade-insecure-requests` (`lib/security/csp.ts`), which helps browsers upgrade subresources; it does not replace fixing bad absolute `http://` URLs.

### 2.3 Integrations

- [ ] **Supabase** — Project URL is `https://*.supabase.co` (default).
- [ ] **Microsoft Graph / Entra** — `https://login.microsoftonline.com`, `https://graph.microsoft.com` (aligned with `connect-src` in CSP).
- [ ] **Sentry** — Ingest hosts use `https://` (CSP allows `*.ingest.*.sentry.io`).
- [ ] Any other third-party script or API — confirm HTTPS endpoints only.

## 3. Verify after production deploy

These steps confirm the header is actually served (Next config + CDN).

1. Open the **production** site in a browser.
2. **DevTools → Network** → select **document** (HTML) or any same-origin response.
3. **Response headers** must include:
   ```http
   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
   ```
4. Optional CLI (replace host):
   ```bash
   curl -sI https://your-production-domain.com | findstr /i strict-transport
   ```
   On Windows PowerShell you can use:
   ```powershell
   curl.exe -sI https://your-production-domain.com
   ```
   and inspect the `strict-transport-security` line.

**If the header is missing:** Confirm the request hits **production** (`VERCEL_ENV=production`), not preview; confirm `next.config.ts` was deployed; clear CDN cache if you use an external proxy in front of Vercel.

## 4. Functional test (HTTP → HTTPS)

Vercel **redirects HTTP to HTTPS** at the edge for deployed projects. Still verify behavior for **your** hostname:

1. Visit `http://your-production-domain.com` (plain HTTP).
2. Expect **301/308 redirect** to `https://your-production-domain.com` (or first load then HSTS on subsequent visits).
3. Spot-check routes: `/`, a dashboard path, and an `/api/...` URL — all should be served over HTTPS only in normal use.

**Automated note:** After the first successful HTTPS response with HSTS, the browser **caches** the policy; further “tests” of `http://` may show no network request to HTTP (browser upgrades internally).

## 5. Risk and rollback documentation

### 5.1 Why rollback is not instant

- HSTS is **cached by the browser** for the duration of `max-age` (here, up to two years until clients refresh the policy).
- **Removing** the `Strict-Transport-Security` header from the server does **not** immediately allow HTTP for users who already received the header; they keep applying HSTS until the cache expires (or policy is updated with a new `max-age`).

### 5.2 Operational risks

| Risk | Mitigation |
|------|------------|
| Wrong `includeSubDomains` breaks a legacy HTTP subdomain | Inventory subdomains **before** long `max-age` + preload; fix or move to HTTPS. |
| Preload submission mistakes | Use [hstspreload.org](https://hstspreload.org/) checklist; coordinate DNS/TLS owners. |
| Staging got HSTS unintentionally | This repo avoids HSTS on **Vercel preview** (`VERCEL_ENV !== 'production'`). Keep staging on preview or a separate domain with clear env. |

### 5.3 Emergency mitigation (rare)

If a serious HTTPS misconfiguration is discovered:

1. Fix **TLS / certificates / routing** on the origin first.
2. If you must shorten client-held HSTS: ship a **new** `Strict-Transport-Security` with **lower** `max-age=0` (browsers stop enforcing after handling the update — behavior is documented in RFC 6797). Coordinate with security/DNS owners; this is a **last resort** and must be tested.

### 5.4 Environment policy (this project)

- **Production (Vercel production):** HSTS eligible as configured.
- **Preview / dev:** No HSTS from this config — do not rely on preview for “will HSTS break my site?” — use a **staging custom domain** with TLS and manual checks if needed.

---

## 6. Summary checklist (quick)

| Item | |
|------|---|
| Config value matches `max-age=63072000; includeSubDomains; preload` | Yes (when eligible) |
| Codebase scan: no production-only `http://` asset URLs found in TS/TSX (dev localhost fallbacks only) | OK — keep `NEXT_PUBLIC_APP_URL` as `https://` in prod |
| Post-deploy: response header visible on production | **Verify manually** (section 3) |
| HTTP → HTTPS redirect | **Verify manually** on Vercel (section 4) |
| Team understands cache + rollback limits | This doc |

*This file is descriptive. It does not change runtime behavior.*
