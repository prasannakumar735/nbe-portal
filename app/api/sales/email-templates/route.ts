import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  createSalesEmailTemplate,
  listSalesEmailTemplates,
} from '@/lib/sales/repositories/salesEmailTemplateRepository'
import {
  createSalesEmailTemplateBodySchema,
  salesEmailTemplateListQuerySchema,
} from '@/lib/sales/validators/emailTemplate.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = salesEmailTemplateListQuerySchema.parse({
      campaignTypeId: searchParams.get('campaignTypeId') ?? undefined,
    })
    const templates = await listSalesEmailTemplates(auth.supabase, {
      campaignTypeId: parsed.campaignTypeId,
    })
    return ok({ templates })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load templates', 500)
  }
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 65_536)
    const body = await request.json()
    const parsed = createSalesEmailTemplateBodySchema.parse(body)
    const template = await createSalesEmailTemplate(auth.supabase, {
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
    return fail(error instanceof Error ? error.message : 'Failed to create template', 500)
  }
}
