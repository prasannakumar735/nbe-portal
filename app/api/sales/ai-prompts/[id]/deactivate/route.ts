import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { deactivateSalesAiPrompt } from '@/lib/sales/repositories/salesAiPromptRepository'
import { salesAiPromptIdParamSchema } from '@/lib/sales/validators'



type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { id } = salesAiPromptIdParamSchema.parse({ id: (await context.params).id })
    const prompt = await deactivateSalesAiPrompt(auth.supabase, id)
    return ok({ prompt })
  } catch (error) {
    if (error instanceof ZodError) return fail('Validation failed', 422, error.issues)
    return fail(error instanceof Error ? error.message : 'Failed to deactivate prompt', 500)
  }
}
