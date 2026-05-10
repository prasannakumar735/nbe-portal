import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileFromTable } from '@/lib/auth/roles'
import {
  melbourneCalendarDate,
  melbourneLocalYmdHmToUtc,
  melbourneNowIsAtOrAfterToday,
} from '@/lib/officeClock/melbourneWallClock'
import { completeOfficeClockTimesheet } from '@/lib/officeClock/completeOfficeClockTimesheet'

/**
 * Synthetic "forgotten sign-out" (07:00–16:00 Melbourne, break 30) when:
 * - clock-in Melbourne calendar day is **before** today Melbourne → eligible anytime (cron/self heals
 *   open sessions carried past midnight — no manager step required).
 * - same Melbourne calendar day as `now` → eligible only once local wall time ≥ 17:00.
 *
 * Futuristic dates (clock_in mis-set) → not eligible unless same-day rule applies rarely; sessionDay >
 * today is rejected.
 */
export function isForgottenOfficeSessionSyntheticEligible(clockInAt: Date, now: Date = new Date()): boolean {
  if (Number.isNaN(clockInAt.getTime())) return false
  const sessionDay = melbourneCalendarDate(clockInAt)
  const today = melbourneCalendarDate(now)
  if (sessionDay > today) return false
  if (sessionDay < today) return true
  return melbourneNowIsAtOrAfterToday(17, 0, now)
}

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
  const sessionDay = melbourneCalendarDate(args.clockInAt)

  let clockOutInstant: Date
  try {
    clockOutInstant = melbourneLocalYmdHmToUtc(sessionDay, '16:00')
  } catch (e) {
    return {
      ok: false,
      status: 500,
      message: e instanceof Error ? e.message : 'Could not resolve synthetic clock-out time.',
    }
  }

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
    breakMinutes: 30,
    workTypeLevel2IdFromBody: null,
  })

  if (!done.ok) {
    return { ok: false, status: done.status, message: done.message }
  }

  return { ok: true, closedDate: sessionDay }
}
