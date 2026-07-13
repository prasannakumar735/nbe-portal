import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { createPipelineOpportunityFromBusiness } from '@/lib/sales/pipeline/pipelineService'
import { listSalesPipelineOpportunities } from '@/lib/sales/repositories/salesPipelineOpportunityRepository'
import {
  createSalesPipelineOpportunityBodySchema,
  salesPipelineOpportunityListQuerySchema,
} from '@/lib/sales/validators/pipeline.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = salesPipelineOpportunityListQuerySchema.parse({
      stage: searchParams.get('stage') ?? undefined,
      ownerUserId: searchParams.get('ownerUserId') ?? undefined,
      openOnly: searchParams.get('openOnly') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    const rows = await listSalesPipelineOpportunities(auth.supabase, {
      stage: parsed.stage,
      ownerUserId: parsed.ownerUserId,
      openOnly: parsed.openOnly,
      limit: parsed.limit,
    })
    return ok({ opportunities: rows })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load pipeline', 500)
  }
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 8_192)
    const body = await request.json()
    const parsed = createSalesPipelineOpportunityBodySchema.parse(body)
    const opportunity = await createPipelineOpportunityFromBusiness(auth.supabase, {
      businessId: parsed.businessId,
      contactId: parsed.contactId,
      campaignId: parsed.campaignId,
      title: parsed.title,
      ownerUserId: parsed.ownerUserId ?? auth.userId,
    })
    if (parsed.stage || parsed.revenueCents != null || parsed.notes) {
      const { updateSalesPipelineOpportunity } = await import(
        '@/lib/sales/repositories/salesPipelineOpportunityRepository'
      )
      const patched = await updateSalesPipelineOpportunity(
        auth.supabase,
        opportunity.id,
        {
          stage: parsed.stage,
          revenue_cents: parsed.revenueCents,
          probability_percent: parsed.probabilityPercent,
          inspection_value_cents: parsed.inspectionValueCents,
          next_follow_up_at: parsed.nextFollowUpAt,
          notes: parsed.notes,
        },
        auth.userId,
      )
      return ok({ opportunity: patched })
    }
    return ok({ opportunity })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to create opportunity', 500)
  }
}
