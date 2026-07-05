import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { runEmailGenerationAgent } from '@/lib/sales/agents/emailGenerationAgent'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { ensureActivePromptForCampaign } from '@/lib/sales/prompts/promptPreviewService'
import { campaignIdParamSchema, emailGenerationRequestSchema } from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteContext = { params: Promise<{ campaignId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 16_384)
    const { campaignId } = campaignIdParamSchema.parse(await context.params)
    const body = await request.json().catch(() => ({}))
    const parsed = emailGenerationRequestSchema.parse(body)

    const campaign = await getSalesCampaignById(auth.supabase, campaignId)
    if (!campaign) {
      return fail('Campaign not found.', 404)
    }

    await ensureActivePromptForCampaign(auth.supabase, campaignId)

    const result = await runEmailGenerationAgent(auth.supabase, {
      campaignId,
      createdBy: auth.userId,
      provider: parsed.provider,
      processImmediately: parsed.processImmediately,
      contactIds: parsed.contactIds,
    })

    return ok(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Email generation failed', 500)
  }
}
