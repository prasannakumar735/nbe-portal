import type { SupabaseClient } from '@supabase/supabase-js'
import { acquireEmailSendRateLimit } from '@/lib/sales/sending/emailSendRateLimiter'
import { processEmailSendQueueItem } from '@/lib/sales/sending/emailSenderWorker'
import type { EmailSenderWorkerResult } from '@/lib/sales/sending/emailSenderWorker'
import {
  getSalesEmailSendQueueById,
  listQueuedSalesEmailSendItems,
  requeueStuckSalesEmailSendQueueItems,
} from '@/lib/sales/repositories/salesEmailSendQueueRepository'
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

  let queueIds: string[]
  if (options?.queueIds?.length) {
    const rows = await Promise.all(
      options.queueIds.map((id) => getSalesEmailSendQueueById(supabase, id)),
    )
    queueIds = rows.filter((r) => r?.status === 'queued').map((r) => r!.id)
  } else {
    const rows = await listQueuedSalesEmailSendItems(supabase, limit)
    queueIds = rows.map((r) => r.id)
  }

  for (const queueId of queueIds.slice(0, limit)) {
    await acquireEmailSendRateLimit()
    results.push(
      await processEmailSendQueueItem(supabase, queueId, {
        maxAttempts,
      }),
    )
  }

  return { recoveredStuck, results }
}
