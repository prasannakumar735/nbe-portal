import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { getSalesBusinessSummary } from '@/lib/sales/repositories/salesBusinessRepository'
import { salesBusinessSummaryQuerySchema } from '@/lib/sales/validation'



export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = salesBusinessSummaryQuerySchema.parse({
      postcode: searchParams.get('postcode') ?? undefined,
    })
    const summary = await getSalesBusinessSummary(auth.supabase, parsed)
    return ok(summary)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load summary', 500)
  }
}
