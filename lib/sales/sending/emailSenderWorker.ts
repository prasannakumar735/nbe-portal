import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyDeliveryFailure } from '@/lib/sales/sending/deliveryFailureClassifier'
import { sendEmail } from '@/lib/sales/sending/emailSenderAdapter'
import { calculateNextRetryTime } from '@/lib/sales/sending/retryScheduler'
import { createSalesEmailDeliveryLog } from '@/lib/sales/repositories/salesEmailDeliveryLogRepository'
import {
  claimSalesEmailSendQueueItem,
  getSalesEmailSendQueueById,
  markSalesEmailSendQueueBounced,
  markSalesEmailSendQueueFailed,
  markSalesEmailSendQueueSent,
  requeueSalesEmailSendQueueItem,
} from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import {
  getSalesGeneratedEmailById,
  markSalesGeneratedEmailSent,
} from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import {
  listSalesContactsByIds,
  updateSalesContactVerification,
} from '@/lib/sales/repositories/salesContactRepository'
import {
  markBounceDetected,
  onOutboundEmailSent,
} from '@/lib/sales/followup/engagementTracker'
import type { SalesEmailSendQueue } from '@/lib/sales/types/emailSendQueue.types'

export type EmailSenderWorkerResult = {
  queueId: string
  outcome: 'sent' | 'failed' | 'bounced' | 'retry' | 'skipped'
  errorMessage?: string
}

export async function processEmailSendQueueItem(
  supabase: SupabaseClient,
  queueId: string,
  _options?: { maxAttempts?: number },
): Promise<EmailSenderWorkerResult> {
  const claimed = await claimSalesEmailSendQueueItem(supabase, queueId)
  if (!claimed) {
    const existing = await getSalesEmailSendQueueById(supabase, queueId)
    if (!existing) {
      return { queueId, outcome: 'skipped', errorMessage: 'Queue item not found.' }
    }
    return {
      queueId,
      outcome: 'skipped',
      errorMessage: `Queue item not claimable (status: ${existing.status}).`,
    }
  }

  return executeSendForQueueRecord(supabase, claimed)
}

async function executeSendForQueueRecord(
  supabase: SupabaseClient,
  queue: SalesEmailSendQueue,
): Promise<EmailSenderWorkerResult> {
  const email = await getSalesGeneratedEmailById(supabase, queue.generated_email_id)
  if (!email) {
    await markSalesEmailSendQueueFailed(supabase, queue.id)
    await createSalesEmailDeliveryLog(supabase, {
      queue_id: queue.id,
      provider: queue.provider,
      status: 'failed',
      failure_reason: 'Generated email not found.',
    })
    return { queueId: queue.id, outcome: 'failed', errorMessage: 'Generated email not found.' }
  }

  const contacts = await listSalesContactsByIds(supabase, [queue.contact_id])
  const contact = contacts[0]
  const recipient = contact?.email?.trim()
  if (!recipient) {
    await markSalesEmailSendQueueFailed(supabase, queue.id)
    await createSalesEmailDeliveryLog(supabase, {
      queue_id: queue.id,
      provider: queue.provider,
      status: 'failed',
      failure_reason: 'Contact has no email address.',
    })
    return { queueId: queue.id, outcome: 'failed', errorMessage: 'Contact has no email address.' }
  }

  try {
    const result = await sendEmail({
      recipient,
      subject: email.subject,
      body: email.body,
      provider: queue.provider,
    })

    await createSalesEmailDeliveryLog(supabase, {
      queue_id: queue.id,
      provider: queue.provider,
      status: 'success',
      external_message_id: result.externalMessageId || null,
      latency_ms: result.latencyMs,
    })

    await markSalesEmailSendQueueSent(supabase, queue.id)
    await markSalesGeneratedEmailSent(supabase, email.id)

    await onOutboundEmailSent(supabase, {
      generatedEmailId: email.id,
      contact_id: queue.contact_id,
      campaign_id: queue.campaign_id,
    })

    return { queueId: queue.id, outcome: 'sent' }
  } catch (error) {
    const classification = classifyDeliveryFailure(error)

    await createSalesEmailDeliveryLog(supabase, {
      queue_id: queue.id,
      provider: queue.provider,
      status: classification.status,
      failure_reason: classification.failureReason,
    })

    if (classification.queueStatus === 'bounced') {
      await markSalesEmailSendQueueBounced(supabase, queue.id)
      if (contact) {
        await updateSalesContactVerification(supabase, contact.id, contact.business_id, {
          email_verified: false,
          verification_status: 'bounced',
        })
      }
      await markBounceDetected(supabase, {
        contact_id: queue.contact_id,
        campaign_id: queue.campaign_id,
      })
      return { queueId: queue.id, outcome: 'bounced', errorMessage: classification.failureReason }
    }

    const retryPlan = calculateNextRetryTime(queue.attempts)
    if ('scheduledAt' in retryPlan) {
      const requeued = await requeueSalesEmailSendQueueItem(
        supabase,
        queue.id,
        retryPlan.scheduledAt.toISOString(),
      )
      if (requeued) {
        return { queueId: queue.id, outcome: 'retry', errorMessage: classification.failureReason }
      }
    }

    await markSalesEmailSendQueueFailed(supabase, queue.id)
    return { queueId: queue.id, outcome: 'failed', errorMessage: classification.failureReason }
  }
}
