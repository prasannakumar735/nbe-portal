import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getSalesFollowupQueueById,
  listDueScheduledSalesFollowupQueue,
} from '@/lib/sales/repositories/salesFollowupQueueRepository'
import {
  processScheduledFollowup,
  type FollowupWorkerResult,
} from '@/lib/sales/followup/followupWorker'

const DEFAULT_DISPATCH_LIMIT = 10

export type DispatchFollowupQueueOptions = {
  limit?: number
  queueIds?: string[]
}

/** @alias DispatchFollowupQueueOptions */
export type DispatchSalesFollowupQueueOptions = DispatchFollowupQueueOptions

export type FollowupQueueDispatchResult = {
  results: FollowupWorkerResult[]
}

/** @alias FollowupQueueDispatchResult */
export type SalesFollowupQueueDispatchResult = FollowupQueueDispatchResult

/**
 * Claim and execute one due follow-up queue row (scheduled → worker pipeline).
 */
export async function processFollowupQueueItem(
  supabase: SupabaseClient,
  queueId: string,
): Promise<FollowupWorkerResult> {
  return processScheduledFollowup(supabase, queueId)
}

/**
 * Poll due scheduled follow-ups and dispatch workers sequentially.
 */
export async function dispatchFollowupQueue(
  supabase: SupabaseClient,
  options?: DispatchFollowupQueueOptions,
): Promise<FollowupQueueDispatchResult> {
  const limit = options?.limit ?? DEFAULT_DISPATCH_LIMIT
  const results: FollowupWorkerResult[] = []

  let queueIds: string[]
  if (options?.queueIds?.length) {
    const rows = await Promise.all(
      options.queueIds.map((id) => getSalesFollowupQueueById(supabase, id)),
    )
    queueIds = rows
      .filter((r) => r?.status === 'scheduled')
      .filter((r) => r && new Date(r.scheduled_at).getTime() <= Date.now())
      .map((r) => r!.id)
  } else {
    const rows = await listDueScheduledSalesFollowupQueue(supabase, limit)
    queueIds = rows.map((r) => r.id)
  }

  for (const queueId of queueIds.slice(0, limit)) {
    try {
      results.push(await processFollowupQueueItem(supabase, queueId))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Follow-up queue dispatch failed.'
      results.push({ queueId, outcome: 'failed', errorMessage: message })
    }
  }

  return { results }
}

/** @alias dispatchFollowupQueue */
export const dispatchSalesFollowupQueue = dispatchFollowupQueue
