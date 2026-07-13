import type { SupabaseClient } from '@supabase/supabase-js'
import { SALES_ENGINE_SETTING_KEYS } from '@/lib/sales/constants/salesEngineSettingKeys'
import { classifyDeliveryFailure } from '@/lib/sales/sending/deliveryFailureClassifier'
import { sendEmail } from '@/lib/sales/sending/emailSenderAdapter'
import { calculateNextRetryTime } from '@/lib/sales/sending/retryScheduler'
import { MAX_EMAIL_SEND_ATTEMPTS } from '@/lib/sales/sending/emailSendQueue.constants'
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
import { resolveOutboundEmailWithAttachments } from '@/lib/sales/sending/resolveOutboundEmailAttachments'
import {
  isFeatureEnabled,
  loadSalesEngineSettings,
  resolveOutboundRecipient,
} from '@/lib/sales/settings/salesEngineSettingsService'
import type { SalesEmailSendQueue } from '@/lib/sales/types/emailSendQueue.types'

export type EmailSenderWorkerResult = {
  queueId: string
  outcome: 'sent' | 'failed' | 'bounced' | 'retry' | 'skipped'
  errorMessage?: string
}

export async function processEmailSendQueueItem(
  supabase: SupabaseClient,
  queueId: string,
  options?: { maxAttempts?: number },
): Promise<EmailSenderWorkerResult> {
  const maxAttempts = options?.maxAttempts ?? MAX_EMAIL_SEND_ATTEMPTS
  const settings = await loadSalesEngineSettings(supabase)

  if (!isFeatureEnabled(settings, SALES_ENGINE_SETTING_KEYS.CAMPAIGN_SENDING_ENABLED)) {
    return {
      queueId,
      outcome: 'skipped',
      errorMessage: 'Campaign sending is disabled in Sales Engine administration settings.',
    }
  }

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

  if (claimed.attempts > maxAttempts) {
    await markSalesEmailSendQueueFailed(supabase, claimed.id)
    await createSalesEmailDeliveryLog(supabase, {
      queue_id: claimed.id,
      provider: claimed.provider,
      status: 'failed',
      failure_reason: `Maximum send attempts (${maxAttempts}) exceeded.`,
    })
    return {
      queueId: claimed.id,
      outcome: 'failed',
      errorMessage: `Maximum send attempts (${maxAttempts}) exceeded.`,
    }
  }

  return executeSendForQueueRecord(supabase, claimed, maxAttempts, settings)
}

async function executeSendForQueueRecord(
  supabase: SupabaseClient,
  queue: SalesEmailSendQueue,
  maxAttempts: number,
  settings: Awaited<ReturnType<typeof loadSalesEngineSettings>>,
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

  if (email.status !== 'queued') {
    await markSalesEmailSendQueueFailed(supabase, queue.id)
    await createSalesEmailDeliveryLog(supabase, {
      queue_id: queue.id,
      provider: queue.provider,
      status: 'failed',
      failure_reason: `Generated email is not approved for send (status: ${email.status}).`,
    })
    return {
      queueId: queue.id,
      outcome: 'failed',
      errorMessage: 'Only queued (approved) emails may be sent.',
    }
  }

  const contacts = await listSalesContactsByIds(supabase, [queue.contact_id])
  const contact = contacts[0]
  const intendedRecipient = contact?.email?.trim()
  if (!intendedRecipient) {
    await markSalesEmailSendQueueFailed(supabase, queue.id)
    await createSalesEmailDeliveryLog(supabase, {
      queue_id: queue.id,
      provider: queue.provider,
      status: 'failed',
      failure_reason: 'Contact has no email address.',
    })
    return { queueId: queue.id, outcome: 'failed', errorMessage: 'Contact has no email address.' }
  }

  const recipientResolution = resolveOutboundRecipient(settings, intendedRecipient)
  if (!recipientResolution.ok) {
    await markSalesEmailSendQueueFailed(supabase, queue.id)
    await createSalesEmailDeliveryLog(supabase, {
      queue_id: queue.id,
      provider: queue.provider,
      status: 'failed',
      failure_reason: recipientResolution.errorMessage,
      intended_recipient_email: intendedRecipient,
      actual_recipient_email: null,
      safe_delivery_mode: settings.safeDeliveryEnabled,
    })
    return {
      queueId: queue.id,
      outcome: 'failed',
      errorMessage: recipientResolution.errorMessage,
    }
  }

  const { actualRecipient, safeDeliveryActive } = recipientResolution.resolved

  try {
    const outbound = await resolveOutboundEmailWithAttachments(supabase, {
      generatedEmailId: email.id,
      body: email.body,
    })

    const attachments = isFeatureEnabled(settings, SALES_ENGINE_SETTING_KEYS.ATTACHMENT_SENDING_ENABLED)
      ? outbound.attachments
      : []

    const result = await sendEmail({
      recipient: actualRecipient,
      subject: email.subject,
      body: outbound.body,
      provider: queue.provider,
      attachments,
    })

    await createSalesEmailDeliveryLog(supabase, {
      queue_id: queue.id,
      provider: queue.provider,
      status: 'success',
      external_message_id: result.externalMessageId || null,
      latency_ms: result.latencyMs,
      intended_recipient_email: intendedRecipient,
      actual_recipient_email: actualRecipient,
      safe_delivery_mode: safeDeliveryActive,
    })

    await markSalesEmailSendQueueSent(supabase, queue.id)
    await markSalesGeneratedEmailSent(supabase, email.id)

    if (isFeatureEnabled(settings, SALES_ENGINE_SETTING_KEYS.EMAIL_TRACKING_ENABLED)) {
      await onOutboundEmailSent(supabase, {
        generatedEmailId: email.id,
        contact_id: queue.contact_id,
        campaign_id: queue.campaign_id,
      })
    }

    return { queueId: queue.id, outcome: 'sent' }
  } catch (error) {
    const classification = classifyDeliveryFailure(error)

    await createSalesEmailDeliveryLog(supabase, {
      queue_id: queue.id,
      provider: queue.provider,
      status: classification.status,
      failure_reason: classification.failureReason,
      intended_recipient_email: intendedRecipient,
      actual_recipient_email: actualRecipient,
      safe_delivery_mode: safeDeliveryActive,
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
    if ('scheduledAt' in retryPlan && queue.attempts < maxAttempts) {
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
