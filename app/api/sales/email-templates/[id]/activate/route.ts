import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { setSalesEmailTemplateActive } from '@/lib/sales/repositories/salesEmailTemplateRepository'
import { activateSalesEmailTemplateBodySchema } from '@/lib/sales/validators/emailTemplate.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'



type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 4096)
    const { id } = await context.params
    if (!id?.trim()) return fail('Template id is required.', 400)

    const body = await request.json()
    const { isActive } = activateSalesEmailTemplateBodySchema.parse(body)
    const template = await setSalesEmailTemplateActive(auth.supabase, id, isActive)
    return ok({ template })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    if (error instanceof Error && error.message === 'Email template not found.') {
      return fail(error.message, 404)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update template status', 500)
  }
}
