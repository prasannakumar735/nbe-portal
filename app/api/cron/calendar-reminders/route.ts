import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { runCalendarRemindersJob } from '@/lib/cron/jobs/calendarRemindersJob'
import { jsonError500 } from '@/lib/security/safeApiError'




export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const result = await runCalendarRemindersJob()
    if (result.ok === false && 'error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (e) {
    return jsonError500(e, 'calendar-reminders-cron')
  }
}
