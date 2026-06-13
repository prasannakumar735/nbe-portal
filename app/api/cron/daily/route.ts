import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { runCalendarRemindersJob } from '@/lib/cron/jobs/calendarRemindersJob'
import { runForgottenOfficeCloseJob } from '@/lib/cron/jobs/forgottenOfficeCloseJob'
import { runServiceDueRemindersJob } from '@/lib/cron/jobs/serviceDueRemindersJob'
import { runWeeklyTimesheetRemindersJob } from '@/lib/cron/jobs/weeklyTimesheetRemindersJob'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'
export const maxDuration = 60

type JobResult = Record<string, unknown> | { ok: false; error: string }

async function runJobSafe(
  name: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<JobResult> {
  try {
    return await fn()
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : `${name} failed`,
    }
  }
}

/** Vercel Hobby: single daily cron entry runs all portal scheduled jobs. */
export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const ranAt = new Date().toISOString()

    const forgottenOfficeClose = await runJobSafe('forgottenOfficeClose', runForgottenOfficeCloseJob)
    const calendarReminders = await runJobSafe('calendarReminders', runCalendarRemindersJob)
    const serviceDueReminders = await runJobSafe('serviceDueReminders', runServiceDueRemindersJob)
    const weeklyTimesheetReminders = await runJobSafe(
      'weeklyTimesheetReminders',
      runWeeklyTimesheetRemindersJob,
    )

    const jobs = {
      forgottenOfficeClose,
      calendarReminders,
      serviceDueReminders,
      weeklyTimesheetReminders,
    }

    const anyHardFail = Object.values(jobs).some(
      j => j && typeof j === 'object' && j.ok === false && 'error' in j,
    )

    return NextResponse.json({
      ok: !anyHardFail,
      ranAt,
      jobs,
    })
  } catch (e) {
    return jsonError500(e, 'cron-daily')
  }
}
