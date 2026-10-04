import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { runWeeklyTimesheetRemindersJob } from '@/lib/cron/jobs/weeklyTimesheetRemindersJob'
import { jsonError500 } from '@/lib/security/safeApiError'


export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const result = await runWeeklyTimesheetRemindersJob()
    return NextResponse.json(result)
  } catch (e) {
    return jsonError500(e, 'weekly-timesheet-reminders-cron')
  }
}
