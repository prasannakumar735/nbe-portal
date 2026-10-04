import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  getSalesFollowupSequenceByCampaignId,
  upsertSalesFollowupSequence,
} from '@/lib/sales/repositories/salesFollowupSequenceRepository'
import { upsertSalesFollowupSequenceBodySchema } from '@/lib/sales/validators/followup.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'



type RouteContext = { params: Promise<{ campaignId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { campaignId } = await context.params
    const sequence = await getSalesFollowupSequenceByCampaignId(auth.supabase, campaignId)
    return ok({ sequence })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load sequence', 500)
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 4_096)
    const { campaignId } = await context.params
    const body = await request.json()
    const parsed = upsertSalesFollowupSequenceBodySchema.parse(body)
    if (parsed.campaignId !== campaignId) {
      return fail('campaignId mismatch.', 422)
    }
    const sequence = await upsertSalesFollowupSequence(auth.supabase, {
      campaign_id: campaignId,
      enabled: parsed.enabled,
      max_followups: parsed.maxFollowups,
      followup_delay_days: parsed.followupDelayDays,
      stop_on_reply: parsed.stopOnReply,
    })
    return ok({ sequence })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to save sequence', 500)
  }
}
