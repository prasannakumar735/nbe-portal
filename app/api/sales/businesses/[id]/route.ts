import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { updateSalesBusinessSelected } from '@/lib/sales/repositories/salesBusinessRepository'
import { salesBusinessSelectedPatchSchema } from '@/lib/sales/validation'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'



type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 4096)
    const { id } = await context.params
    if (!id?.trim()) {
      return fail('Business id is required.', 400)
    }
    const body = await request.json()
    const { selected } = salesBusinessSelectedPatchSchema.parse(body)
    const updated = await updateSalesBusinessSelected(auth.supabase, id, selected)
    return ok(updated)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    if (error instanceof Error && error.message === 'Business not found.') {
      return fail(error.message, 404)
    }
    return fail(error instanceof Error ? error.message : 'Update failed', 500)
  }
}
