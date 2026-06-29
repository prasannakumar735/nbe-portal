import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { listSalesBusinesses } from '@/lib/sales/repositories/salesBusinessRepository'
import { salesBusinessListQuerySchema } from '@/lib/sales/validators'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = salesBusinessListQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      postcode: searchParams.get('postcode') ?? undefined,
      scanRunId: searchParams.get('scanRunId') ?? undefined,
    })
    const result = await listSalesBusinesses(auth.supabase, {
      page: parsed.page,
      pageSize: parsed.pageSize,
      postcode: parsed.postcode,
      scanRunId: parsed.scanRunId,
    })
    return ok(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load businesses', 500)
  }
}
