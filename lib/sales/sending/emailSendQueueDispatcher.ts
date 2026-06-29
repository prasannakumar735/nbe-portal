import type { SupabaseClient } from '@supabase/supabase-js'
import { processEmailSendQueueItem } from '@/lib/sales/sending/emailSenderWorker'
import type { EmailSenderWorkerResult } from '@/lib/sales/sending/emailSenderWorker'
import {
  getSalesEmailSendQueueById,
  listQueuedSalesEmailSendItems,
} from '@/lib/sales/repositories/salesEmailSendQueueRepository'

const DEFAULT_DISPATCH_LIMIT = 10

export type DispatchEmailSendQueueOptions = {
  limit?: number
  queueIds?: string[]
  maxAttempts?: number
}

export type EmailSendQueueDispatchResult = {
  results: EmailSenderWorkerResult[]
}

export async function dispatchEmailSendQueue(
  supabase: SupabaseClient,
  options?: DispatchEmailSendQueueOptions,
): Promise<EmailSendQueueDispatchResult> {
  const limit = options?.limit ?? DEFAULT_DISPATCH_LIMIT
  const results: EmailSenderWorkerResult[] = []

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
    results.push(
      await processEmailSendQueueItem(supabase, queueId, {
        maxAttempts: options?.maxAttempts,
      }),
    )
  }

  return { results }
}
