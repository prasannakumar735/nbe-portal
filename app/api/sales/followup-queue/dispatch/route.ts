import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { dispatchFollowupQueue } from '@/lib/sales/followup/followupQueueDispatcher'
import { dispatchSalesFollowupQueueBodySchema } from '@/lib/sales/validators/followup.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'



export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 8_192)
    const body = await request.json().catch(() => ({}))
    const parsed = dispatchSalesFollowupQueueBodySchema.parse(body)
    const result = await dispatchFollowupQueue(auth.supabase, {
      limit: parsed.limit,
      queueIds: parsed.queueIds,
    })
    const awaiting = result.results.filter((r) => r.outcome === 'awaiting_review').length
    return ok({ ...result, summary: { awaiting, ...countOutcomes(result.results) } })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Follow-up dispatch failed', 500)
  }
}

function countOutcomes(results: { outcome: string }[]) {
  return {
    skipped: results.filter((r) => r.outcome === 'skipped').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
  }
}
