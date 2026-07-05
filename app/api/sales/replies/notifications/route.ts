import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  countUnreadSalesManagerNotifications,
  listSalesManagerNotifications,
  markSalesManagerNotificationsRead,
} from '@/lib/sales/repositories/salesManagerNotificationRepository'
import {
  markSalesManagerNotificationsReadBodySchema,
  salesManagerNotificationListQuerySchema,
} from '@/lib/sales/validators/replyManagement.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const url = new URL(request.url)
    const parsed = salesManagerNotificationListQuerySchema.parse({
      unreadOnly: url.searchParams.get('unreadOnly') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })

    const [unreadCount, notifications] = await Promise.all([
      countUnreadSalesManagerNotifications(auth.supabase),
      listSalesManagerNotifications(auth.supabase, {
        unreadOnly: parsed.unreadOnly,
        limit: parsed.limit ?? 50,
      }),
    ])

    return ok({ unreadCount, notifications })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to load notifications', 500)
  }
}

export async function PATCH(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 16_384)
    const body = await request.json()
    const parsed = markSalesManagerNotificationsReadBodySchema.parse(body)

    await markSalesManagerNotificationsRead(auth.supabase, parsed.notificationIds)

    const unreadCount = await countUnreadSalesManagerNotifications(auth.supabase)
    return ok({ unreadCount, marked: parsed.notificationIds.length })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update notifications', 500)
  }
}
