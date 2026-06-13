import type { ManagerAttendanceRow } from '@/lib/officeClock/fetchManagerAttendance'
import { formatDurationHm } from '@/lib/timecard/formatDuration'

export type AttendanceSignedInNowRow = {
  sessionId: string
  userId: string
  employeeName: string
  dateMelbourne: string
  signInMelbourne: string
  siteName: string
}

export type AttendanceDashboard = {
  todayMelbourne: string
  /** Distinct employees with a sign-in on today's Melbourne calendar date */
  loggedInTodayCount: number
  /** Open sessions (currently signed in) org-wide */
  signedInNowCount: number
  signedInNow: AttendanceSignedInNowRow[]
  /** Mean gross duration for closed sessions in the selected date range (decimal hours, legacy) */
  averageHoursInRange: number | null
  /** Mean gross duration formatted Hm */
  averageDurationDisplay: string | null
  /** Open sessions in the selected date range */
  missingSignOutsInRange: number
}

export function computeRangeAttendanceSummary(rows: ManagerAttendanceRow[]): {
  averageHoursInRange: number | null
  averageDurationDisplay: string | null
  missingSignOutsInRange: number
} {
  const open = rows.filter(r => r.status === 'open')
  const grossMinutes = rows
    .map(r => r.durationGrossMinutes)
    .filter((m): m is number => m != null && Number.isFinite(m))
  const averageHoursInRange =
    grossMinutes.length > 0
      ? Math.round((grossMinutes.reduce((a, b) => a + b, 0) / grossMinutes.length / 60) * 100) / 100
      : null
  const averageDurationDisplay =
    grossMinutes.length > 0
      ? formatDurationHm(Math.round(grossMinutes.reduce((a, b) => a + b, 0) / grossMinutes.length))
      : null
  return {
    averageHoursInRange,
    averageDurationDisplay,
    missingSignOutsInRange: open.length,
  }
}
