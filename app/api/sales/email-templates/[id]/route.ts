import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { updateSalesEmailTemplate } from '@/lib/sales/repositories/salesEmailTemplateRepository'
import { updateSalesEmailTemplateBodySchema } from '@/lib/sales/validators/emailTemplate.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'



type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 65_536)
    const { id } = await context.params
    if (!id?.trim()) return fail('Template id is required.', 400)

    const body = await request.json()
    const parsed = updateSalesEmailTemplateBodySchema.parse(body)
    if (Object.keys(parsed).length === 0) {
      return fail('No fields to update.', 400)
    }

    const template = await updateSalesEmailTemplate(auth.supabase, id, {
      campaign_type_id: parsed.campaignTypeId,
      template_name: parsed.templateName,
      prompt_config: parsed.promptConfig,
      is_active: parsed.isActive,
    })
    return ok({ template })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    if (error instanceof Error && error.message === 'Email template not found.') {
      return fail(error.message, 404)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update template', 500)
  }
}
