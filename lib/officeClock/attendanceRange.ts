import {
  melbourneCalendarDate,
  melbourneLocalYmdHmToUtc,
  mondayWeekStartForCalendarDate,
} from '@/lib/officeClock/melbourneWallClock'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export const ATTENDANCE_MAX_RANGE_DAYS = 93

export function parseAttendanceDate(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().slice(0, 10)
  if (!DATE_RE.test(s)) return null
  const y = Number(s.slice(0, 4))
  const mo = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  const utc = new Date(Date.UTC(y, mo - 1, d))
  if (Number.isNaN(utc.getTime())) return null
  return s
}

/** Monday–Sunday (Melbourne calendar) for the week containing today in Melbourne. */
export function defaultMelbourneAttendanceWeek(): { dateFrom: string; dateTo: string } {
  const today = melbourneCalendarDate(new Date())
  const dateFrom = mondayWeekStartForCalendarDate(today)
  const dateTo = addCalendarDays(dateFrom, 6)
  return { dateFrom, dateTo }
}

export function addCalendarDays(yyyyMmDd: string, days: number): string {
  const m = DATE_RE.exec(yyyyMmDd.trim())
  if (!m) throw new Error('Invalid calendar date')
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const utc = new Date(Date.UTC(y, mo - 1, d))
  utc.setUTCDate(utc.getUTCDate() + days)
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function calendarDaysInclusive(from: string, to: string): number {
  const a = DATE_RE.exec(from.trim())
  const b = DATE_RE.exec(to.trim())
  if (!a || !b) return NaN
  const d0 = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]))
  const d1 = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]))
  if (Number.isNaN(d0) || Number.isNaN(d1)) return NaN
  return Math.floor((d1 - d0) / (24 * 60 * 60 * 1000)) + 1
}

export function resolveAttendanceDateRange(
  dateFromRaw: string | null | undefined,
  dateToRaw: string | null | undefined,
):
  | { ok: true; dateFrom: string; dateTo: string }
  | { ok: false; message: string } {
  const defaults = defaultMelbourneAttendanceWeek()
  const dateFrom = parseAttendanceDate(dateFromRaw) ?? defaults.dateFrom
  const dateTo = parseAttendanceDate(dateToRaw) ?? defaults.dateTo
  if (dateFrom > dateTo) {
    return { ok: false, message: 'dateFrom must be on or before dateTo.' }
  }
  const span = calendarDaysInclusive(dateFrom, dateTo)
  if (!Number.isFinite(span) || span < 1) {
    return { ok: false, message: 'Invalid date range.' }
  }
  if (span > ATTENDANCE_MAX_RANGE_DAYS) {
    return { ok: false, message: `Date range may not exceed ${ATTENDANCE_MAX_RANGE_DAYS} days.` }
  }
  return { ok: true, dateFrom, dateTo }
}

/** UTC instants for filtering clock_in_at: [start, endExclusive). */
export function attendanceClockInUtcBounds(dateFrom: string, dateTo: string): {
  startIso: string
  endExclusiveIso: string
} {
  const start = melbourneLocalYmdHmToUtc(dateFrom, '00:00')
  const dayAfterTo = addCalendarDays(dateTo, 1)
  const endExclusive = melbourneLocalYmdHmToUtc(dayAfterTo, '00:00')
  return { startIso: start.toISOString(), endExclusiveIso: endExclusive.toISOString() }
}
