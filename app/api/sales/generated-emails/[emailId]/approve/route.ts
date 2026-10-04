import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { approveGeneratedEmail } from '@/lib/sales/review/generatedEmailReviewService'
import { generatedEmailReviewIdParamSchema } from '@/lib/sales/validators'
import { SalesGeneratedEmailReviewError } from '@/lib/sales/repositories/salesGeneratedEmailRepository'



type RouteContext = { params: Promise<{ emailId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { emailId } = generatedEmailReviewIdParamSchema.parse({
      emailId: (await context.params).emailId,
    })
    const email = await approveGeneratedEmail(auth.supabase, emailId, {
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
    return fail(error instanceof Error ? error.message : 'Failed to approve email', 500)
  }
}
