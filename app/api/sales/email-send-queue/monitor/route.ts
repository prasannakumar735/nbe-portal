import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { getEmailSendQueueMonitorSnapshot } from '@/lib/sales/sending/emailSendMonitorService'
import { emailSendQueueMonitorQuerySchema } from '@/lib/sales/validators'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = emailSendQueueMonitorQuerySchema.parse({
      campaignId: searchParams.get('campaignId') ?? undefined,
    })
    const snapshot = await getEmailSendQueueMonitorSnapshot(auth.supabase, {
      campaignId: parsed.campaignId,
    })
    return ok({ snapshot })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Monitor failed', 500)
  }
}
