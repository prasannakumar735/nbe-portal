import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { processSalesJobs } from '@/lib/sales/jobs/jobProcessor'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_CRON_BATCH = 20

export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const limitRaw = request.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? Math.min(50, Math.max(1, Number(limitRaw))) : DEFAULT_CRON_BATCH
    const supabase = createServiceRoleClient()
    const results = await processSalesJobs(supabase, { limit })
    return NextResponse.json({ ok: true, processed: results.length, results })
  } catch (e) {
    return jsonError500(e, 'sales-jobs-cron')
  }
}
