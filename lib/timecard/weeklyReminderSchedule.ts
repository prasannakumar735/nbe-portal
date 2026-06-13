import { addCalendarDays } from '@/lib/officeClock/attendanceRange'
import {
  melbourneCalendarDate,
  melbourneNowIsAtOrAfterToday,
  mondayWeekStartForCalendarDate,
} from '@/lib/officeClock/melbourneWallClock'

export const OFFICE_CLOCK_TZ = 'Australia/Melbourne'

/** ISO week: Monday = 1 … Sunday = 7 */
export function melbourneWeekday(at: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE_CLOCK_TZ,
    weekday: 'short',
  }).format(at)
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  return map[wd] ?? 1
}

export function currentWeekStartMelbourne(at: Date = new Date()): string {
  return mondayWeekStartForCalendarDate(melbourneCalendarDate(at))
}

/** Monday of the ISO week immediately before the week containing `todayMelb`. */
export function priorWeekStart(todayMelb: string): string {
  const thisMonday = mondayWeekStartForCalendarDate(todayMelb)
  return addCalendarDays(thisMonday, -7)
}

export function formatDdMmYyyy(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!m) return isoDate
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function isReminder1Window(at: Date = new Date()): boolean {
  return melbourneWeekday(at) === 5 && melbourneNowIsAtOrAfterToday(17, 0, at)
}

export function isReminder2Day(at: Date = new Date()): boolean {
  return melbourneWeekday(at) === 1
}

export function isManagerDigestWindow(at: Date = new Date()): boolean {
  return melbourneWeekday(at) === 1 && melbourneNowIsAtOrAfterToday(8, 0, at)
}

/**
 * Auto-submit eligible when Melbourne calendar date is at least 2 days after
 * the Melbourne calendar date of reminder_2_sent_at.
 */
export function isAutoSubmitDue(reminder2SentAtIso: string, at: Date = new Date()): boolean {
  const sentMelb = melbourneCalendarDate(new Date(reminder2SentAtIso))
  const dueMelb = addCalendarDays(sentMelb, 2)
  const todayMelb = melbourneCalendarDate(at)
  return todayMelb >= dueMelb
}

export function weekEndFromStartIso(weekStartIso: string): string {
  return addCalendarDays(weekStartIso, 6)
}
