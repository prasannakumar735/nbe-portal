import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { listSalesGeneratedEmailHistory } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { campaignContactParamSchema } from '@/lib/sales/validators'



type RouteContext = { params: Promise<{ campaignId: string; contactId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { campaignId, contactId } = campaignContactParamSchema.parse(await context.params)
    const history = await listSalesGeneratedEmailHistory(auth.supabase, campaignId, contactId)
    return ok({ history })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load history', 500)
  }
}
