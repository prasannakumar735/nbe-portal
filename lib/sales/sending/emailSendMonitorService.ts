import type { SupabaseClient } from '@supabase/supabase-js'
import { listRecentSalesEmailDeliveryFailures } from '@/lib/sales/repositories/salesEmailDeliveryLogRepository'
import {
  countSalesEmailSendQueueByStatus,
  listSalesEmailSendQueue,
} from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import type { SalesEmailDeliveryLog } from '@/lib/sales/types/emailDeliveryLog.types'
import type { SalesEmailSendQueue } from '@/lib/sales/types/emailSendQueue.types'
import type { SalesEmailSendQueueStatusCounts } from '@/lib/sales/repositories/salesEmailSendQueueRepository'

export type EmailSendQueueMonitorSnapshot = {
  counts: SalesEmailSendQueueStatusCounts
  pendingSend: number
  recentFailures: SalesEmailDeliveryLog[]
  activeItems: SalesEmailSendQueue[]
}

export async function getEmailSendQueueMonitorSnapshot(
  supabase: SupabaseClient,
  options?: { campaignId?: string },
): Promise<EmailSendQueueMonitorSnapshot> {
  const counts = await countSalesEmailSendQueueByStatus(supabase, {
    campaignId: options?.campaignId,
  })
  const pendingSend = counts.queued + counts.sending

  const recentFailures = await listRecentSalesEmailDeliveryFailures(supabase, {
    campaignId: options?.campaignId,
    limit: 15,
  })

  const activeItems = await listSalesEmailSendQueue(supabase, {
    campaignId: options?.campaignId,
    limit: 50,
  })

  const activeFiltered = activeItems.filter((row) =>
  ['queued', 'sending', 'failed'].includes(row.status),
  )

  return {
    counts,
    pendingSend,
    recentFailures,
    activeItems: activeFiltered,
  }
}
