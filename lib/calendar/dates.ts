/** Local calendar day as YYYY-MM-DD */
export function formatIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse `YYYY-MM-DD` to local date at midnight, or null if invalid. */
export function parseIsoCalendarDate(iso: string): Date | null {
  const parts = iso.split('-').map(Number)
  const y = parts[0]
  const mo = parts[1]
  const day = parts[2]
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return null
  const d = new Date(y, mo - 1, day)
  d.setHours(0, 0, 0, 0)
  return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === day ? d : null
}

/** Monday 00:00 local for the ISO week containing `d`. */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Local date for the first day of `d`'s month. */
export function startOfCalendarMonth(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(1)
  return x
}

/** Local date for the last day of `d`'s month. */
export function endOfCalendarMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Outlook-style month matrix: Monday-start weeks filling 6 rows (42 days),
 * spanning the calendar month containing `anchorInMonth`.
 */
export function getMonthCalendarGridDates(anchorInMonth: Date): Date[] {
  const firstOfMonth = startOfCalendarMonth(anchorInMonth)
  const gridStart = startOfWeekMonday(firstOfMonth)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}
