/**
 * Nonce-based Content-Security-Policy for the App Router.
 * Middleware sets `x-nonce` + `Content-Security-Policy`; Next.js applies nonces to framework scripts when the request carries CSP.
 *
 * Dev: `unsafe-eval` on scripts (React dev tools), `unsafe-inline` on styles (faster iteration).
 * Prod: strict `script-src` / `style-src` with per-request nonces (no `unsafe-inline` / `unsafe-eval`).
 * **`strict-dynamic`**: host entries in `script-src` are ignored for trust — external scripts (e.g.
 * Cloudflare Turnstile `api.js`) must use a **nonce** on `<script>` (see `TurnstileWidget` + `x-nonce`).
 * `style-src-attr 'unsafe-inline'` allows `style=""` on elements (React/Turnstile) without allowing
 * unnonced `<style>` tags — see MDN `style-src-attr`.
 */

const isProd = process.env.NODE_ENV === 'production'

/** Cloudflare Turnstile — extend `script-src` / `frame-src` / `connect-src` / `worker-src` together (do not drop other origins). */
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'

export function generateCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = !isProd

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    TURNSTILE_ORIGIN,
    ...(isDev ? (["'unsafe-eval'"] as const) : []),
  ].join(' ')

  // `'unsafe-inline'` on styles only: Recharts and some client libs inject `<style>` blocks; scripts stay strict.
  const styleSrc = isDev
    ? ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'].join(' ')
    : ["'self'", `'nonce-${nonce}'`, "'unsafe-inline'", 'https://fonts.googleapis.com'].join(' ')

  const parts = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    // Inline `style=""` (React hydration, Turnstile) — does not relax `<style>` tags (still nonce-only).
    ...(isProd ? (["style-src-attr 'unsafe-inline'"] as const) : []),
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `frame-src 'self' ${TURNSTILE_ORIGIN}`,
    // Turnstile may spin workers from Cloudflare origin (not only blob:).
    `worker-src 'self' blob: ${TURNSTILE_ORIGIN}`,
    [
      'connect-src',
      "'self'",
      // Canvas/data URLs — `fetch(data:...)` (e.g. signature upload) requires these
      'data:',
      'blob:',
      TURNSTILE_ORIGIN,
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://login.microsoftonline.com',
      'https://graph.microsoft.com',
      'https://nominatim.openstreetmap.org',
      'https://maps.googleapis.com',
      'https://*.ingest.us.sentry.io',
      'https://*.ingest.de.sentry.io',
      'https://*.ingest.sentry.io',
    ].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? (['upgrade-insecure-requests'] as const) : []),
  ]

  return parts.join('; ')
}
