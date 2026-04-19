import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

/**
 * Content-Security-Policy is set per request in `middleware.ts` (nonce + `strict-dynamic`).
 * Do not duplicate CSP here — it would conflict with nonce-based policies.
 */
/** `next dev` / non-production builds — no HSTS. */
const isProd = process.env.NODE_ENV === 'production'

/**
 * Vercel: `NODE_ENV` is `production` for preview deploys too; gate HSTS on `VERCEL_ENV` so
 * staging/preview URLs are not sent long-lived HSTS. Non-Vercel (`next start`, etc.): `VERCEL_ENV`
 * is unset — treat as production when `isProd` is true.
 */
const hstsEligible =
  isProd && (process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : true)

const hstsHeader = {
  key: 'Strict-Transport-Security',
  value: 'max-age=63072000; includeSubDomains; preload',
} as const

const baseSecurityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(self), interest-cohort=(), payment=(), xr-spatial-tracking=(self "https://challenges.cloudflare.com")',
  },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [...baseSecurityHeaders, ...(hstsEligible ? [hstsHeader] : [])],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  /** Source map upload optional — set `SENTRY_AUTH_TOKEN` + org/project in CI when ready */
  widenClientFileUpload: false,
})
