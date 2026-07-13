import type { SupabaseClient } from '@supabase/supabase-js'
import { recordCampaignEngagementEvent } from '@/lib/sales/engagement/campaignEngagementService'
import { listSalesEmailDeliveryLogsByQueueId } from '@/lib/sales/repositories/salesEmailDeliveryLogRepository'
import { listSalesEmailSendQueue } from '@/lib/sales/repositories/salesEmailSendQueueRepository'

export type SyncDeliveryEngagementResult = {
  deliveredRecorded: number
  bouncedRecorded: number
  skipped: number
}

/**
 * Derives delivered/bounced engagement from existing send queue + delivery logs.
 * Does not modify the send worker or generation pipeline.
 */
export async function syncCampaignEngagementFromDeliveryArtifacts(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<SyncDeliveryEngagementResult> {
  const queues = await listSalesEmailSendQueue(supabase, { campaignId, limit: 500 })
  let deliveredRecorded = 0
  let bouncedRecorded = 0
  let skipped = 0

  for (const queue of queues) {
    if (queue.status === 'sent') {
      const logs = await listSalesEmailDeliveryLogsByQueueId(supabase, queue.id)
      const success = logs.find((l) => l.status === 'success')
      if (!success) {
        skipped += 1
        continue
      }
      const event = await recordCampaignEngagementEvent(supabase, {
        campaignId: queue.campaign_id,
        contactId: queue.contact_id,
        eventType: 'delivered',
        source: 'delivery_log',
        generatedEmailId: queue.generated_email_id,
        queueId: queue.id,
        occurredAt: queue.sent_at ?? success.created_at,
        idempotencyKey: `delivery_log:${success.id}`,
      })
      if (event) deliveredRecorded += 1
      else skipped += 1
      continue
    }

    if (queue.status === 'bounced') {
      const event = await recordCampaignEngagementEvent(supabase, {
        campaignId: queue.campaign_id,
        contactId: queue.contact_id,
        eventType: 'bounced',
        source: 'delivery_log',
        generatedEmailId: queue.generated_email_id,
        queueId: queue.id,
        idempotencyKey: `queue_bounced:${queue.id}`,
      })
      if (event) bouncedRecorded += 1
      else skipped += 1
    }
  }

  return { deliveredRecorded, bouncedRecorded, skipped }
}
