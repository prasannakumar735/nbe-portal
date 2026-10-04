import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { bulkQueueApprovedEmails, queueApprovedEmail } from '@/lib/sales/sending/emailSendQueueService'
import { SalesEmailSendQueueError } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { listSalesEmailSendQueue } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import {
  emailSendQueueListQuerySchema,
  queueApprovedEmailBodySchema,
} from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'



export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const parsed = emailSendQueueListQuerySchema.parse({
      campaignId: searchParams.get('campaignId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    const items = await listSalesEmailSendQueue(auth.supabase, {
      campaignId: parsed.campaignId,
      status: parsed.status,
      limit: parsed.limit,
    })
    return ok({ items })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to list queue', 500)
  }
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 16_384)
    const body = await request.json()
    const parsed = queueApprovedEmailBodySchema.parse(body)
    const item = await queueApprovedEmail(auth.supabase, parsed.generatedEmailId, {
      provider: parsed.provider,
      scheduledAt: parsed.scheduledAt,
    })
    return ok({ item })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    if (error instanceof SalesEmailSendQueueError) {
      return fail(error.message, 409)
    }
    return fail(error instanceof Error ? error.message : 'Failed to queue email', 500)
  }
}
