import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { dispatchEmailSendQueue } from '@/lib/sales/sending/emailSendQueueDispatcher'
import { dispatchEmailSendQueueBodySchema } from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'
import { listQueuedSalesEmailSendItems } from '@/lib/sales/repositories/salesEmailSendQueueRepository'



export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 16_384)
    const body = await request.json()
    const parsed = dispatchEmailSendQueueBodySchema.parse(body)

    let queueIds = parsed.queueIds
    if (!queueIds?.length && parsed.campaignId) {
      const rows = await listQueuedSalesEmailSendItems(auth.supabase, 50)
      queueIds = rows.filter((r) => r.campaign_id === parsed.campaignId).map((r) => r.id)
    }

    const result = await dispatchEmailSendQueue(auth.supabase, {
      limit: parsed.limit,
      queueIds,
    })

    const sent = result.results.filter((r) => r.outcome === 'sent').length
    const failed = result.results.filter((r) => r.outcome === 'failed' || r.outcome === 'bounced').length
    const retry = result.results.filter((r) => r.outcome === 'retry').length

    return ok({
      ...result,
      summary: { sent, failed, retry, skipped: result.results.length - sent - failed - retry },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Dispatch failed', 500)
  }
}
