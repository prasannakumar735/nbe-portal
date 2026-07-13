import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  getSalesPipelineOpportunityById,
  updateSalesPipelineOpportunity,
} from '@/lib/sales/repositories/salesPipelineOpportunityRepository'
import { appendAssistantNotesBodySchema } from '@/lib/sales/validators/salesAssistant.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

/** Manager explicitly appends assistant output to pipeline notes (never automatic). */
export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 32_000)
    const body = await request.json()
    const parsed = appendAssistantNotesBodySchema.parse(body)
    const existing = await getSalesPipelineOpportunityById(auth.supabase, parsed.opportunityId)
    if (!existing) return fail('Opportunity not found.', 404)

    const stamp = new Date().toISOString()
    const block = `\n\n--- AI assistant (${stamp}) ---\n${parsed.text}`
    const opportunity = await updateSalesPipelineOpportunity(
      auth.supabase,
      parsed.opportunityId,
      { notes: `${existing.notes}${block}` },
      auth.userId,
    )
    return ok({ opportunity })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to save notes', 500)
  }
}
