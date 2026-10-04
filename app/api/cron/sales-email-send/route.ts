import { NextRequest, NextResponse } from 'next/server'
import { assertCronSecret } from '@/lib/cron/assertCronSecret'
import { dispatchEmailSendQueue } from '@/lib/sales/sending/emailSendQueueDispatcher'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { jsonError500 } from '@/lib/security/safeApiError'




const DEFAULT_CRON_BATCH = 15

export async function GET(request: NextRequest) {
  try {
    const denied = assertCronSecret(request)
    if (denied) return denied

    const limitRaw = request.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? Math.min(50, Math.max(1, Number(limitRaw))) : DEFAULT_CRON_BATCH
    const supabase = createServiceRoleClient()
    const result = await dispatchEmailSendQueue(supabase, { limit })

    const sent = result.results.filter((r) => r.outcome === 'sent').length

    return NextResponse.json({
      ok: true,
      processed: result.results.length,
      sent,
      recoveredStuck: result.recoveredStuck,
      results: result.results,
    })
  } catch (e) {
    return jsonError500(e, 'sales-email-send-cron')
  }
}
