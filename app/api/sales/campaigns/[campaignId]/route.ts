import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { campaignIdParamSchema } from '@/lib/sales/validators'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ campaignId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { campaignId } = campaignIdParamSchema.parse(await context.params)
    const campaign = await getSalesCampaignById(auth.supabase, campaignId)
    if (!campaign) {
      return fail('Campaign not found.', 404)
    }
    return ok({ campaign })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load campaign', 500)
  }
}
