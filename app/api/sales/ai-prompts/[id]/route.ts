import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  getSalesAiPromptById,
  updateSalesAiPrompt,
} from '@/lib/sales/repositories/salesAiPromptRepository'
import { salesAiPromptIdParamSchema, updateSalesAiPromptBodySchema } from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'



type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { id } = salesAiPromptIdParamSchema.parse({ id: (await context.params).id })
    const prompt = await getSalesAiPromptById(auth.supabase, id)
    if (!prompt) return fail('Prompt not found.', 404)
    return ok({ prompt })
  } catch (error) {
    if (error instanceof ZodError) return fail('Validation failed', 422, error.issues)
    return fail(error instanceof Error ? error.message : 'Failed to load prompt', 500)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 131_072)
    const { id } = salesAiPromptIdParamSchema.parse({ id: (await context.params).id })
    const body = await request.json()
    const parsed = updateSalesAiPromptBodySchema.parse(body)
    const prompt = await updateSalesAiPrompt(auth.supabase, id, {
      definition: parsed.definition,
      description: parsed.description,
    })
    return ok({ prompt })
  } catch (error) {
    if (error instanceof ZodError) return fail('Validation failed', 422, error.issues)
    return fail(error instanceof Error ? error.message : 'Failed to update prompt', 500)
  }
}
