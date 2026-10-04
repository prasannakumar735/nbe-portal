import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { runForgottenOfficeCloseJob } from '@/lib/cron/jobs/forgottenOfficeCloseJob'
import { jsonError500 } from '@/lib/security/safeApiError'



/**
 * Processes open office attendance sessions eligible for synthetic "forgotten sign-out".
 * Uses service role after CRON_SECRET check. Production schedule: daily via `/api/cron/daily`.
 */
export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const result = await runForgottenOfficeCloseJob()
    if (result.ok === false && 'error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (e) {
    return jsonError500(e, 'office-clock-auto-close-forgotten')
  }
}
