import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { bulkRejectGeneratedEmails } from '@/lib/sales/review/generatedEmailReviewService'
import { bulkGeneratedEmailReviewBodySchema } from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 65_536)
    const body = await request.json()
    const parsed = bulkGeneratedEmailReviewBodySchema.parse(body)
    const result = await bulkRejectGeneratedEmails(auth.supabase, parsed.emailIds, {
      reviewedBy: auth.userId,
    })
    return ok(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Bulk reject failed', 500)
  }
}
