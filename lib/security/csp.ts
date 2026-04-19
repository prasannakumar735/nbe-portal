/**
 * Nonce-based Content-Security-Policy for the App Router.
 * Middleware sets `x-nonce` + `Content-Security-Policy`; Next.js applies nonces to framework scripts when the request carries CSP.
 *
 * Dev: `unsafe-eval` on scripts (React dev tools), `unsafe-inline` on styles (faster iteration).
 * Prod: strict `script-src` / `style-src` with per-request nonces (no `unsafe-inline` / `unsafe-eval`).
 */

const isProd = process.env.NODE_ENV === 'production'

export function generateCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = !isProd

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    'https://challenges.cloudflare.com',
    ...(isDev ? (["'unsafe-eval'"] as const) : []),
  ].join(' ')

  const styleSrc = isDev
    ? ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'].join(' ')
    : ["'self'", `'nonce-${nonce}'`, 'https://fonts.googleapis.com'].join(' ')

  const parts = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    [
      'connect-src',
      "'self'",
      'https://challenges.cloudflare.com',
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
