import { addCalendarDays } from '@/lib/officeClock/attendanceRange'
import { mondayWeekStartForCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import type { EmployeeTimesheetStatus } from '@/lib/types/employee-timesheet.types'
import { OFFICE_CLOCK_TZ, melbourneWeekday } from '@/lib/timecard/weeklyReminderSchedule'

export type TimesheetBannerKind = 'due_friday' | 'overdue' | 'auto_submitted' | null

export type TimesheetBannerState = {
  kind: TimesheetBannerKind
  message: string
}

function melbourneTodayIso(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OFFICE_CLOCK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

function melbourneMinutesSinceMidnight(at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: OFFICE_CLOCK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const h = Number(parts.find(x => x.type === 'hour')?.value ?? '0')
  const m = Number(parts.find(x => x.type === 'minute')?.value ?? '0')
  return h * 60 + m
}

export function computeTimesheetBannerState(params: {
  viewedWeekStart: string
  status: EmployeeTimesheetStatus | null | undefined
  totalHours: number
  submittedVia?: string | null
  autoSubmittedAt?: string | null
  at?: Date
}): TimesheetBannerState {
  const at = params.at ?? new Date()
  const todayMelb = melbourneTodayIso(at)
  const currentWeekStart = mondayWeekStartForCalendarDate(todayMelb)
  const priorWeekStart = addCalendarDays(currentWeekStart, -7)

  if (params.submittedVia === 'system' || params.autoSubmittedAt) {
    return {
      kind: 'auto_submitted',
      message:
        'This week was auto-submitted by the system. Contact your manager if you need corrections.',
    }
  }

  const pending =
    params.status === 'draft' || params.status === 'rejected'
  const hasHours = params.totalHours > 0

  if (!pending || !hasHours) {
    return { kind: null, message: '' }
  }

  if (params.viewedWeekStart === currentWeekStart) {
    const wd = melbourneWeekday(at)
    const mins = melbourneMinutesSinceMidnight(at)
    const beforeFri5pm = wd < 5 || (wd === 5 && mins < 17 * 60)
    if (beforeFri5pm) {
      return {
        kind: 'due_friday',
        message: 'Your timecard for this week is due for submission by Friday 5:00 pm (Melbourne).',
      }
    }
  }

  if (params.viewedWeekStart === priorWeekStart && todayMelb >= currentWeekStart) {
    return {
      kind: 'overdue',
      message: 'This timecard is overdue for submission. Please submit as soon as possible.',
    }
  }

  return { kind: null, message: '' }
}
