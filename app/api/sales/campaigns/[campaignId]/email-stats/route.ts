import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { getCampaignEmailStats } from '@/lib/sales/review/campaignEmailStatsService'
import { campaignIdParamSchema } from '@/lib/sales/validators'



type RouteContext = { params: Promise<{ campaignId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { campaignId } = campaignIdParamSchema.parse(await context.params)
    const stats = await getCampaignEmailStats(auth.supabase, campaignId)
    return ok({ stats })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    if (error instanceof Error && error.message === 'Campaign not found.') {
      return fail(error.message, 404)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load stats', 500)
  }
}
