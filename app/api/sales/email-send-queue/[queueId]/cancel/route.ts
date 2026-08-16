import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { cancelQueuedEmail } from '@/lib/sales/sending/emailSendQueueService'
import { emailSendQueueIdParamSchema } from '@/lib/sales/validators'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ queueId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const params = await context.params
    const { queueId } = emailSendQueueIdParamSchema.parse(params)
    const item = await cancelQueuedEmail(auth.supabase, queueId)
    if (!item) {
      return fail('Queue item could not be cancelled (wrong status or not found).', 409)
    }
    return ok({ item })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Cancel failed', 500)
  }
}
