import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SALES_REPLY_CATEGORY_NOTIFICATION_PRIORITY,
  type SalesManagerNotificationPriority,
  type SalesManagerNotificationType,
} from '@/lib/sales/constants/managerNotifications'
import type {
  SalesReplyAnalysisCategory,
  SalesReplyAnalysisStatus,
} from '@/lib/sales/constants/replyAnalysis'
import { insertSalesManagerNotification } from '@/lib/sales/repositories/salesManagerNotificationRepository'

const CATEGORY_NOTIFICATION_PRIORITY: SalesReplyAnalysisCategory[] = [
  'needs_quote',
  'wants_site_inspection',
  'interested',
  'pricing_question',
  'technical_question',
  'existing_customer',
  'not_interested',
  'wrong_contact',
  'unsubscribe',
]

function categoryToNotificationType(
  category: SalesReplyAnalysisCategory,
): SalesManagerNotificationType {
  switch (category) {
    case 'needs_quote':
      return 'quote_requested'
    case 'wants_site_inspection':
      return 'inspection_requested'
    case 'unsubscribe':
      return 'unsubscribe'
    default:
      return 'customer_replied'
  }
}

function resolveNotificationPriority(
  categories: SalesReplyAnalysisCategory[],
  urgency: string | null | undefined,
  analysisStatus: SalesReplyAnalysisStatus,
): SalesManagerNotificationPriority {
  if (analysisStatus === 'failed') return 'low'

  let priority: SalesManagerNotificationPriority = 'medium'
  for (const cat of categories) {
    const mapped = SALES_REPLY_CATEGORY_NOTIFICATION_PRIORITY[cat]
    if (mapped === 'high') return 'high'
    if (mapped === 'low') priority = 'low'
  }

  if (urgency === 'high' && priority !== 'high') {
    return 'medium'
  }

  return priority
}

function pickPrimaryCategory(
  categories: SalesReplyAnalysisCategory[],
): SalesReplyAnalysisCategory | null {
  for (const preferred of CATEGORY_NOTIFICATION_PRIORITY) {
    if (categories.includes(preferred)) return preferred
  }
  return categories[0] ?? null
}

export async function createReplyAnalysisNotifications(
  supabase: SupabaseClient,
  input: {
    threadId: string
    messageId: string
    categories: SalesReplyAnalysisCategory[]
    urgency?: string | null
    analysisStatus: SalesReplyAnalysisStatus
  },
): Promise<void> {
  const priority = resolveNotificationPriority(
    input.categories,
    input.urgency,
    input.analysisStatus,
  )

  let notificationType: SalesManagerNotificationType
  if (input.analysisStatus === 'failed') {
    notificationType = 'analysis_failed'
  } else if (input.urgency === 'high') {
    const primary = pickPrimaryCategory(input.categories)
    notificationType =
      primary === 'needs_quote'
        ? 'quote_requested'
        : primary === 'wants_site_inspection'
          ? 'inspection_requested'
          : 'urgent_customer_response'
  } else {
    const primary = pickPrimaryCategory(input.categories)
    notificationType = primary ? categoryToNotificationType(primary) : 'customer_replied'
  }

  await insertSalesManagerNotification(supabase, {
    notification_type: notificationType,
    priority,
    thread_id: input.threadId,
    message_id: input.messageId,
  })
}
