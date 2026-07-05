import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { listCampaignGeneratedEmailReviewRows } from '@/lib/sales/review/campaignGeneratedEmailListService'
import { campaignIdParamSchema, generatedEmailReviewListQuerySchema } from '@/lib/sales/validators'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ campaignId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { campaignId } = campaignIdParamSchema.parse(await context.params)
    const { searchParams } = new URL(request.url)
    const parsed = generatedEmailReviewListQuerySchema.parse({
      campaignId,
      status: searchParams.get('status') ?? undefined,
    })
    const rows = await listCampaignGeneratedEmailReviewRows(auth.supabase, parsed.campaignId, {
      status: parsed.status,
    })
    return ok({ rows })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load emails', 500)
  }
}
