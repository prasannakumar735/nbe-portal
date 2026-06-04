import { melbourneCalendarDate } from '@/lib/officeClock/melbourneWallClock'

/** Today as YYYY-MM-DD in Australia/Melbourne. */
export function quoteTodayMelbourneIso(): string {
  return melbourneCalendarDate(new Date())
}

/** YYYYMMDD in Melbourne — for quote number dateKey. */
export function quoteTodayMelbourneDateKey(): string {
  return quoteTodayMelbourneIso().replace(/-/g, '')
}

/** Add calendar days to an ISO date string (YYYY-MM-DD), returns YYYY-MM-DD. */
export function addCalendarDaysIso(iso: string, days: number): string {
  const t = String(iso ?? '').slice(0, 10)
  const [y, m, d] = t.split('-').map(Number)
  if (!y || !m || !d) return t
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** PDF/display: YYYY-MM-DD → DD-MM-YYYY; other strings unchanged. */
export function formatQuoteDisplayDate(iso: string): string {
  const t = String(iso ?? '').trim().slice(0, 10)
  const [y, m, d] = t.split('-')
  if (!y || !m || !d || y.length !== 4) return String(iso ?? '').trim()
  return `${d}-${m}-${y}`
}
