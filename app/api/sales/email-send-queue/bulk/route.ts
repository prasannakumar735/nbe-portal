import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { bulkQueueApprovedEmails } from '@/lib/sales/sending/emailSendQueueService'
import { SalesEmailSendQueueError } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { bulkQueueApprovedEmailsBodySchema } from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'



export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 65_536)
    const body = await request.json()
    const parsed = bulkQueueApprovedEmailsBodySchema.parse(body)
    const result = await bulkQueueApprovedEmails(auth.supabase, parsed.generatedEmailIds, {
      provider: parsed.provider,
      scheduledAt: parsed.scheduledAt,
    })
    return ok(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    if (error instanceof SalesEmailSendQueueError) {
      return fail(error.message, 409)
    }
    return fail(error instanceof Error ? error.message : 'Bulk queue failed', 500)
  }
}
