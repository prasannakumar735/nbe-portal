import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { regenerateEmailForContact } from '@/lib/sales/generation/emailGenerationOrchestrator'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { ensureActivePromptForCampaign } from '@/lib/sales/prompts/promptPreviewService'
import { resolveDefaultSalesLlmProvider } from '@/lib/sales/constants/llmProviders'
import {
  campaignContactParamSchema,
  regenerateEmailBodySchema,
} from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'


export const maxDuration = 60

type RouteContext = { params: Promise<{ campaignId: string; contactId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 8_192)
    const { campaignId, contactId } = campaignContactParamSchema.parse(await context.params)
    const body = await request.json().catch(() => ({}))
    const parsed = regenerateEmailBodySchema.parse(body)

    const campaign = await getSalesCampaignById(auth.supabase, campaignId)
    if (!campaign) {
      return fail('Campaign not found.', 404)
    }

    await ensureActivePromptForCampaign(auth.supabase, campaignId)

    const provider = parsed.provider ?? resolveDefaultSalesLlmProvider()
    const result = await regenerateEmailForContact(auth.supabase, {
      campaignId,
      contactId,
      provider,
    })

    return ok({ result })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Regeneration failed', 500)
  }
}
