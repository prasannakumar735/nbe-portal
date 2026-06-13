import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { runServiceDueRemindersJob } from '@/lib/cron/jobs/serviceDueRemindersJob'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const result = await runServiceDueRemindersJob()
    if (result.ok === false && 'error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (e) {
    return jsonError500(e, 'service-due-reminders-cron')
  }
}
