import type { SupabaseClient } from '@supabase/supabase-js'
import { acquireEmailSendRateLimit } from '@/lib/sales/sending/emailSendRateLimiter'
import { processEmailSendQueueItem } from '@/lib/sales/sending/emailSenderWorker'
import type { EmailSenderWorkerResult } from '@/lib/sales/sending/emailSenderWorker'
import {
  getSalesEmailSendQueueById,
  listQueuedSalesEmailSendItems,
  requeueStuckSalesEmailSendQueueItems,
  countSalesEmailSendQueueByStatus,
} from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { advanceSalesCampaignStatus } from '@/lib/sales/repositories/salesCampaignRepository'
import { MAX_EMAIL_SEND_ATTEMPTS } from '@/lib/sales/sending/emailSendQueue.constants'

const DEFAULT_DISPATCH_LIMIT = 10

export type DispatchEmailSendQueueOptions = {
  limit?: number
  queueIds?: string[]
  maxAttempts?: number
  /** Re-queue items stuck in `sending` before dispatch (worker crash recovery). */
  recoverStuckSending?: boolean
}

export type EmailSendQueueDispatchResult = {
  recoveredStuck: number
  results: EmailSenderWorkerResult[]
}

export async function dispatchEmailSendQueue(
  supabase: SupabaseClient,
  options?: DispatchEmailSendQueueOptions,
): Promise<EmailSendQueueDispatchResult> {
  const limit = options?.limit ?? DEFAULT_DISPATCH_LIMIT
  const maxAttempts = options?.maxAttempts ?? MAX_EMAIL_SEND_ATTEMPTS
  const results: EmailSenderWorkerResult[] = []

  let recoveredStuck = 0
  if (options?.recoverStuckSending !== false) {
    recoveredStuck = await requeueStuckSalesEmailSendQueueItems(supabase)
  }

  // Capture queue items with their campaign IDs before processing so we can
  // check campaign completion afterward (results carry only queueId, not campaignId).
  let queueItems: { id: string; campaign_id: string }[]
  if (options?.queueIds?.length) {
    const rows = await Promise.all(
      options.queueIds.map((id) => getSalesEmailSendQueueById(supabase, id)),
    )
    queueItems = rows
      .filter((r) => r?.status === 'queued')
      .map((r) => ({ id: r!.id, campaign_id: r!.campaign_id }))
  } else {
    const rows = await listQueuedSalesEmailSendItems(supabase, limit)
    queueItems = rows.map((r) => ({ id: r.id, campaign_id: r.campaign_id }))
  }

  for (const item of queueItems.slice(0, limit)) {
    await acquireEmailSendRateLimit()
    results.push(
      await processEmailSendQueueItem(supabase, item.id, {
        maxAttempts,
      }),
    )
  }

  // After processing, mark sending → completed for any campaign where all
  // queue items are now in terminal states (sent/failed/bounced/cancelled).
  const campaignIds = [...new Set(queueItems.map((i) => i.campaign_id))]
  for (const campaignId of campaignIds) {
    const counts = await countSalesEmailSendQueueByStatus(supabase, { campaignId })
    const activeCount = counts.queued + counts.sending
    if (activeCount === 0) {
      await advanceSalesCampaignStatus(supabase, campaignId, 'sending', 'completed').catch(() => {
        // Non-fatal: campaign may not yet be in sending state.
      })
    }
  }

  return { recoveredStuck, results }
}
