import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { EmailResendError, resendEmailSendQueueItem } from '@/lib/sales/sending/emailResendService'
import { SalesEmailSendQueueError } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { emailSendQueueIdParamSchema } from '@/lib/sales/validators'



type RouteContext = { params: Promise<{ queueId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const params = await context.params
    const { queueId } = emailSendQueueIdParamSchema.parse(params)
    const item = await resendEmailSendQueueItem(auth.supabase, queueId)
    return ok({ item })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    if (error instanceof EmailResendError || error instanceof SalesEmailSendQueueError) {
      return fail(error.message, 409)
    }
    return fail(error instanceof Error ? error.message : 'Resend failed', 500)
  }
}
