/**
 * Nonce-based Content-Security-Policy for the App Router.
 * Middleware sets `x-nonce` + `Content-Security-Policy`; Next.js applies nonces to framework scripts when the request carries CSP.
 *
 * Dev: `unsafe-eval` on scripts (React dev tools), `unsafe-inline` on styles (faster iteration).
 * Prod: strict `script-src` / `style-src` with per-request nonces (no `unsafe-inline` / `unsafe-eval`).
 * Prod also adds **`'wasm-unsafe-eval'`** so `@react-pdf/renderer` (Yoga WASM) can generate PDFs
 * (quote download + `PDFDownloadLink`) without relaxing general `'unsafe-eval'`.
 * **`strict-dynamic`**: host entries in `script-src` are ignored for trust — external scripts (e.g.
 * Cloudflare Turnstile `api.js`) must use a **nonce** on `<script>` (see `TurnstileWidget` + `x-nonce`).
 * `style-src-attr 'unsafe-inline'` allows `style=""` on elements (React/Turnstile) without allowing
 * unnonced `<style>` tags — see MDN `style-src-attr`.
 *
 * **Turnstile inline-script hashes**: Turnstile's `api.js` (trusted via nonce) creates `about:srcdoc`
 * sub-iframes whose inline scripts inherit the parent CSP. Under `strict-dynamic`, hash-sources are still
 * honoured for inline scripts (only host-source entries are ignored), so adding the known hash allows
 * those scripts without weakening the rest of the policy. Update the hash if Cloudflare rotates Turnstile
 * and the browser console reports a new `sha256-...` value in the CSP violation message.
 */

const isProd = process.env.NODE_ENV === 'production'

/** Cloudflare Turnstile — extend `script-src` / `frame-src` / `connect-src` / `worker-src` together (do not drop other origins). */
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'

/**
 * SHA-256 hashes of inline scripts that Turnstile's `api.js` injects into `about:srcdoc` challenge iframes.
 * These inherit the parent page's CSP and must be explicitly hash-allowed.
 * To update: check the browser console CSP violation — it prints the required hash directly.
 */
const TURNSTILE_INLINE_SCRIPT_HASHES = [
  "'sha256-eJGI0Ik4oYe/PKLDOt4wcN76wYs8h+Ew05pMzdY6xG8='",
]

export function generateCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

type FrameAncestorsPolicy = "'none'" | "'self'"

export function buildContentSecurityPolicy(
  nonce: string,
  options?: {
    /**
     * Controls which origins may embed *this response* in a frame/iframe.
     * Default: `'none'` (most strict).
     */
    frameAncestors?: FrameAncestorsPolicy
  },
): string {
  const isDev = !isProd
  const frameAncestors: FrameAncestorsPolicy = options?.frameAncestors ?? "'none'"

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    TURNSTILE_ORIGIN,
    // `@react-pdf/renderer` (Yoga layout) instantiates a WebAssembly module in the browser.
    // CSP3 `'wasm-unsafe-eval'` authorises WASM compile/instantiate WITHOUT re-enabling general `'unsafe-eval'`.
    // Keyword sources are still honored under `'strict-dynamic'` (only host-source entries are ignored).
    "'wasm-unsafe-eval'",
    // Turnstile srcdoc challenge iframes — see TURNSTILE_INLINE_SCRIPT_HASHES above.
    ...TURNSTILE_INLINE_SCRIPT_HASHES,
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
    `frame-src 'self' blob: ${TURNSTILE_ORIGIN}`,
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
    `frame-ancestors ${frameAncestors}`,
    ...(isProd ? (['upgrade-insecure-requests'] as const) : []),
  ]

  return parts.join('; ')
}
