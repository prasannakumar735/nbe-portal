import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  activateSalesAiPrompt,
  SalesAiPromptActivationConflictError,
  SalesAiPromptValidationError,
} from '@/lib/sales/repositories/salesAiPromptRepository'
import { formatResolvedPromptLabel } from '@/lib/sales/prompts/promptLabels'
import { salesAiPromptIdParamSchema } from '@/lib/sales/validators'
import { z } from 'zod'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

const activateBodySchema = z.object({
  confirmReplace: z.boolean().optional(),
})

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = salesAiPromptIdParamSchema.parse({ id: (await context.params).id })
    const body = activateBodySchema.parse(await request.json().catch(() => ({})))
    const prompt = await activateSalesAiPrompt(auth.supabase, id, {
      confirmReplace: body.confirmReplace,
    })
    return ok({ prompt })
  } catch (error) {
    if (error instanceof ZodError) return fail('Validation failed', 422, error.issues)
    if (error instanceof SalesAiPromptValidationError) {
      return fail(error.message, 422, { code: error.code, errors: error.errors })
    }
    if (error instanceof SalesAiPromptActivationConflictError) {
      const current = error.currentActive
      return fail(error.message, 409, {
        code: error.code,
        currentActive: {
          id: current.id,
          version: current.version,
          description: current.description,
          label: formatResolvedPromptLabel({
            productSlug: current.product_slug,
            industrySlug: current.industry_slug,
            useCaseSlug: current.use_case_slug,
            version: current.version,
          }),
        },
      })
    }
    return fail(error instanceof Error ? error.message : 'Failed to activate prompt', 500)
  }
}
