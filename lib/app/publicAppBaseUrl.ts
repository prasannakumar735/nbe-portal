/**
 * Base URL for links/QR embedded in PDFs and API responses (server-side).
 * Matches merge flow: NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost.
 */
export function publicAppBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '').trim()
  if (env) return env
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
  return 'http://localhost:3000'
}

/** Full client viewer URL for a single maintenance report (approved + share_token). */
export function maintenanceReportClientViewUrl(shareToken: string | null | undefined): string | null {
  const t = String(shareToken ?? '').trim()
  if (!t) return null
  return `${publicAppBaseUrl()}/report/view/${encodeURIComponent(t)}`
}
