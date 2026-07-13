import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listRecentSalesEmailDeliveryFailures,
  listRecentSalesEmailDeliverySuccesses,
} from '@/lib/sales/repositories/salesEmailDeliveryLogRepository'
import {
  countSalesEmailSendQueueByStatus,
  listSalesEmailSendQueue,
} from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import type { SalesEmailDeliveryLog } from '@/lib/sales/types/emailDeliveryLog.types'
import type { SalesEmailSendQueue } from '@/lib/sales/types/emailSendQueue.types'
import type { SalesEmailSendQueueStatusCounts } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { loadSalesEngineSettings } from '@/lib/sales/settings/salesEngineSettingsService'

export type EmailSendQueueMonitorSnapshot = {
  counts: SalesEmailSendQueueStatusCounts
  pendingSend: number
  recentFailures: SalesEmailDeliveryLog[]
  recentSuccesses: SalesEmailDeliveryLog[]
  safeDeliveryEnabled: boolean
  safeDeliveryRedirectEmail: string
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
  const settings = await loadSalesEngineSettings(supabase)

  const recentFailures = await listRecentSalesEmailDeliveryFailures(supabase, {
    campaignId: options?.campaignId,
    limit: 15,
  })

  const recentSuccesses = await listRecentSalesEmailDeliverySuccesses(supabase, {
    campaignId: options?.campaignId,
    limit: 8,
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
    recentSuccesses,
    safeDeliveryEnabled: settings.safeDeliveryEnabled,
    safeDeliveryRedirectEmail: settings.safeDeliveryRedirectEmail,
    activeItems: activeFiltered,
  }
}
