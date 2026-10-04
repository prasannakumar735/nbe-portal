import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { dispatchFollowupQueue } from '@/lib/sales/followup/followupQueueDispatcher'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { jsonError500 } from '@/lib/security/safeApiError'


export const maxDuration = 60

const DEFAULT_BATCH = 10

/** Generates follow-up drafts only — does not approve or send. */
export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const limitRaw = request.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? Math.min(25, Math.max(1, Number(limitRaw))) : DEFAULT_BATCH
    const supabase = createServiceRoleClient()
    const result = await dispatchFollowupQueue(supabase, { limit })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return jsonError500(e, 'sales-followup-dispatch-cron')
  }
}
