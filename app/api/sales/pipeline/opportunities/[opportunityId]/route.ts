import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { loadPipelineOpportunityOrThrow } from '@/lib/sales/pipeline/pipelineService'
import {
  getSalesPipelineOpportunityById,
  updateSalesPipelineOpportunity,
} from '@/lib/sales/repositories/salesPipelineOpportunityRepository'
import { updateSalesPipelineOpportunityBodySchema } from '@/lib/sales/validators/pipeline.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ opportunityId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { opportunityId } = await context.params
    const opportunity = await getSalesPipelineOpportunityById(auth.supabase, opportunityId)
    if (!opportunity) return fail('Opportunity not found.', 404)
    return ok({ opportunity })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load opportunity', 500)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 8_192)
    const { opportunityId } = await context.params
    const body = await request.json()
    const parsed = updateSalesPipelineOpportunityBodySchema.parse(body)
    await loadPipelineOpportunityOrThrow(auth.supabase, opportunityId)
    const opportunity = await updateSalesPipelineOpportunity(
      auth.supabase,
      opportunityId,
      {
        title: parsed.title,
        stage: parsed.stage,
        contact_id: parsed.contactId,
        campaign_id: parsed.campaignId,
        revenue_cents: parsed.revenueCents,
        probability_percent: parsed.probabilityPercent,
        inspection_value_cents: parsed.inspectionValueCents,
        owner_user_id: parsed.ownerUserId,
        next_follow_up_at: parsed.nextFollowUpAt,
        notes: parsed.notes,
      },
      auth.userId,
    )
    const hydrated = await getSalesPipelineOpportunityById(auth.supabase, opportunityId)
    return ok({ opportunity: hydrated ?? opportunity })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    if (error instanceof Error && error.message === 'Opportunity not found.') {
      return fail(error.message, 404)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update opportunity', 500)
  }
}
