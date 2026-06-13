import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileFromTable } from '@/lib/auth/roles'
import { isOfficeSiteRowConfigured } from '@/lib/officeClock/envSiteFallback'
import {
  melbourneCalendarDate,
  melbourneLocalYmdHmToUtc,
  melbourneNowIsAtOrAfterToday,
} from '@/lib/officeClock/melbourneWallClock'
import { completeOfficeClockTimesheet } from '@/lib/officeClock/completeOfficeClockTimesheet'
import { officeClockBreakForTimeRange } from '@/lib/officeClock/breakPolicy'

/**
 * Synthetic "forgotten sign-out" (07:00–16:00 Melbourne, break 30) when:
 * - clock-in Melbourne calendar day is **before** today Melbourne → eligible anytime (cron/self heals
 *   open sessions carried past midnight — no manager step required).
 * - same Melbourne calendar day as `now` → eligible only once local wall time ≥ 17:00.
 */
export function isForgottenOfficeSessionSyntheticEligible(clockInAt: Date, now: Date = new Date()): boolean {
  if (Number.isNaN(clockInAt.getTime())) return false
  const sessionDay = melbourneCalendarDate(clockInAt)
  const today = melbourneCalendarDate(now)
  if (sessionDay > today) return false
  if (sessionDay < today) return true
  return melbourneNowIsAtOrAfterToday(17, 0, now)
}

export function syntheticClockOutInstantForSessionDay(sessionDay: string): Date {
  return melbourneLocalYmdHmToUtc(sessionDay, '16:00')
}

/** Idempotent: sets clock_out_at + close_kind=system when still open. */
export async function forceCloseOfficeSessionAttendance(
  supabase: SupabaseClient,
  args: { sessionId: string; userId: string; clockInAt: Date },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sessionDay = melbourneCalendarDate(args.clockInAt)
  let clockOutInstant: Date
  try {
    clockOutInstant = syntheticClockOutInstantForSessionDay(sessionDay)
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Could not resolve synthetic clock-out time.',
    }
  }

  const { data: updated, error } = await supabase
    .from('office_attendance_sessions')
    .update({
      clock_out_at: clockOutInstant.toISOString(),
      close_kind: 'system',
    })
    .eq('id', args.sessionId)
    .eq('user_id', args.userId)
    .is('clock_out_at', null)
    .select('id')

  if (error) {
    console.error('[forceCloseOfficeSessionAttendance]', error)
    return { ok: false, message: 'Could not close attendance session.' }
  }
  if (!updated?.length) {
    return { ok: true }
  }
  return { ok: true }
}

export type ProcessForgottenCloseResult =
  | { ok: true; closedDate: string; mode: 'full' | 'attendance_only'; timesheetError?: string }
  | { ok: false; message: string }

/**
 * Cron + self-heal: try synthetic timesheet line when site configured; always force attendance
 * close when eligible and timesheet path fails (or site not configured on prior Melbourne day).
 */
export async function processForgottenOfficeSessionClose(
  supabase: SupabaseClient,
  args: {
    sessionId: string
    userId: string
    profile: ProfileFromTable | null
    clockInAt: Date
    siteRow: Record<string, unknown> | null
    now?: Date
  },
): Promise<ProcessForgottenCloseResult> {
  const now = args.now ?? new Date()
  if (!isForgottenOfficeSessionSyntheticEligible(args.clockInAt, now)) {
    return { ok: false, message: 'Session not eligible for forgotten close.' }
  }

  const sessionDay = melbourneCalendarDate(args.clockInAt)

  let clockOutInstant: Date
  try {
    clockOutInstant = syntheticClockOutInstantForSessionDay(sessionDay)
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Could not resolve synthetic clock-out time.',
    }
  }

  let timesheetError: string | undefined
  const siteConfigured = args.siteRow != null && isOfficeSiteRowConfigured(args.siteRow)

  if (siteConfigured && args.siteRow) {
    const done = await completeOfficeClockTimesheet({
      supabase,
      userId: args.userId,
      profile: args.profile,
      sessionId: args.sessionId,
      siteRow: args.siteRow,
      clockInActual: args.clockInAt,
      clockOutInstant,
      entryDate: sessionDay,
      startTimeMelbourne: '07:00',
      endTimeMelbourne: '16:00',
      breakMinutes: officeClockBreakForTimeRange('07:00', '16:00'),
      workTypeLevel2IdFromBody: null,
      closeKind: 'system',
    })
    if (done.ok) {
      return { ok: true, closedDate: sessionDay, mode: 'full' }
    }
    timesheetError = done.message
  }

  const forced = await forceCloseOfficeSessionAttendance(supabase, {
    sessionId: args.sessionId,
    userId: args.userId,
    clockInAt: args.clockInAt,
  })
  if (!forced.ok) {
    return { ok: false, message: forced.message }
  }

  return {
    ok: true,
    closedDate: sessionDay,
    mode: 'attendance_only',
    timesheetError,
  }
}

/** @deprecated Prefer processForgottenOfficeSessionClose */
export async function runForgottenSyntheticCloseForSession(
  supabase: SupabaseClient,
  args: {
    sessionId: string
    userId: string
    profile: ProfileFromTable | null
    clockInAt: Date
    siteRow: Record<string, unknown>
  },
): Promise<{ ok: true; closedDate: string } | { ok: false; status: number; message: string }> {
  const result = await processForgottenOfficeSessionClose(supabase, {
    ...args,
    siteRow: args.siteRow,
  })
  if (!result.ok) {
    return { ok: false, status: 400, message: result.message }
  }
  return { ok: true, closedDate: result.closedDate }
}
