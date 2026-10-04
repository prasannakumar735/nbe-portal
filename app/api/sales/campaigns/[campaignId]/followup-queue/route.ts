import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { listSalesFollowupQueue } from '@/lib/sales/repositories/salesFollowupQueueRepository'
import { salesFollowupQueueListQuerySchema } from '@/lib/sales/validators/followup.validators'



type RouteContext = { params: Promise<{ campaignId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { campaignId } = await context.params
    const { searchParams } = new URL(request.url)
    const parsed = salesFollowupQueueListQuerySchema.parse({
      campaignId,
      contactId: searchParams.get('contactId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    const items = await listSalesFollowupQueue(auth.supabase, parsed)
    return ok({ items })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to list follow-up queue', 500)
  }
}
