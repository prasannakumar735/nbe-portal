import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { editGeneratedEmail } from '@/lib/sales/review/generatedEmailReviewService'
import {
  editGeneratedEmailReviewBodySchema,
  generatedEmailReviewIdParamSchema,
} from '@/lib/sales/validators'
import { SalesGeneratedEmailReviewError } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ emailId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 65_536)
    const { emailId } = generatedEmailReviewIdParamSchema.parse({
      emailId: (await context.params).emailId,
    })
    const body = await request.json()
    const parsed = editGeneratedEmailReviewBodySchema.parse(body)

    const email = await editGeneratedEmail(auth.supabase, emailId, parsed, {
      reviewedBy: auth.userId,
    })
    return ok({ email })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    if (error instanceof SalesGeneratedEmailReviewError) {
      return fail(error.message, 409)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update email', 500)
  }
}
