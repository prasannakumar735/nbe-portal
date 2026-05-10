/** All wall-clock parts use Australia/Melbourne (matches NBE operations). */
export const OFFICE_CLOCK_TIMEZONE = 'Australia/Melbourne'

export function melbourneCalendarDate(iso: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OFFICE_CLOCK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(iso)
}

export function melbourneHHMM(iso: Date): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: OFFICE_CLOCK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(iso)
  const h = parts.find(x => x.type === 'hour')?.value ?? '00'
  const m = parts.find(x => x.type === 'minute')?.value ?? '00'
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/**
 * True when `at`'s Melbourne wall clock is at or after `hour`:`minute` (24h).
 */
export function melbourneNowIsAtOrAfterToday(hour: number, minute: number, at: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: OFFICE_CLOCK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const h = Number(parts.find(x => x.type === 'hour')?.value ?? '0')
  const m = Number(parts.find(x => x.type === 'minute')?.value ?? '0')
  return h > hour || (h === hour && m >= minute)
}

/**
 * UTC instant for Melbourne civil `calendarDate` (YYYY-MM-DD) + `hhmm` (HH:mm) on that day.
 * Used so synthetic sign-out stores a real timestamptz (e.g. 16:00 Melbourne).
 */
export function melbourneLocalYmdHmToUtc(calendarDate: string, hhmm: string): Date {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(calendarDate.trim())
  const tm = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!dm || !tm) throw new Error('Invalid Melbourne local date/time')
  const y = Number(dm[1])
  const mo = Number(dm[2])
  const d = Number(dm[3])
  const h = Number(tm[1])
  const mi = Number(tm[2])
  if (![y, mo, d, h, mi].every(n => Number.isFinite(n))) throw new Error('Invalid Melbourne local date/time')

  const want = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: OFFICE_CLOCK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const key = (ms: number) => {
    const parts = formatter.formatToParts(new Date(ms))
    const g = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value ?? ''
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
  }

  let lo = Date.UTC(y, mo - 1, d - 1, 10, 0, 0)
  let hi = Date.UTC(y, mo - 1, d + 1, 14, 0, 0)
  for (let i = 0; i < 96; i++) {
    if (lo > hi) break
    const mid = Math.floor((lo + hi) / 2)
    const k = key(mid)
    if (k < want) lo = mid + 60 * 1000
    else if (k > want) hi = mid - 60 * 1000
    else return new Date(mid)
  }
  return new Date(Math.max(lo, hi))
}

/**
 * Monday YYYY-MM-DD of the ISO week for this calendar date string (YYYY-MM-DD).
 * Uses UTC calendar arithmetic on the date parts only (same Monday for any TZ observer of that civil date).
 */
export function mondayWeekStartForCalendarDate(yyyyMmDd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim())
  if (!m) throw new Error('Invalid calendar date')
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const utc = new Date(Date.UTC(y, mo - 1, d))
  if (Number.isNaN(utc.getTime())) throw new Error('Invalid calendar date')
  const dow = utc.getUTCDay()
  const diff = dow === 0 ? -6 : 1 - dow
  utc.setUTCDate(utc.getUTCDate() + diff)
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
