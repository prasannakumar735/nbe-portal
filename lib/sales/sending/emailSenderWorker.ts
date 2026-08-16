import type { SupabaseClient } from '@supabase/supabase-js'
import { SALES_ENGINE_SETTING_KEYS } from '@/lib/sales/constants/salesEngineSettingKeys'
import { classifyDeliveryFailure } from '@/lib/sales/sending/deliveryFailureClassifier'
import { sendEmail } from '@/lib/sales/sending/emailSenderAdapter'
import { calculateNextRetryTime } from '@/lib/sales/sending/retryScheduler'
import { MAX_EMAIL_SEND_ATTEMPTS } from '@/lib/sales/sending/emailSendQueue.constants'
import { createSalesEmailDeliveryLog } from '@/lib/sales/repositories/salesEmailDeliveryLogRepository'
import {
  addSalesEmailSuppression,
  isSalesEmailSuppressed,
} from '@/lib/sales/repositories/salesEmailSuppressionRepository'
import {
  cancelSalesEmailSendQueueItem,
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
import {
  buildComplianceFooter,
  resolveUnsubscribePresentation,
} from '@/lib/sales/compliance/buildComplianceFooter'
import { buildEngagementTrackingUrls } from '@/lib/sales/engagement/engagementTrackingToken'
import { injectTrackingPixel } from '@/lib/sales/engagement/injectTrackingPixel'
import { getSalesContactEngagement } from '@/lib/sales/repositories/salesContactEngagementRepository'
import { resolveOutboundEmailWithAttachments } from '@/lib/sales/sending/resolveOutboundEmailAttachments'
import {
  appendSalesEmailSignature,
  renderSalesEmailContentHtml,
  wrapSalesEmailDocument,
} from '@/lib/sales/sending/salesEmailHtmlTemplate'
import {
  isFeatureEnabled,
  loadSalesEngineSettings,
  resolveOutboundRecipient,
} from '@/lib/sales/settings/salesEngineSettingsService'
import type { SalesEmailSendQueue } from '@/lib/sales/types/emailSendQueue.types'

export type EmailSenderWorkerResult = {
  queueId: string
  /** `suppressed` = recipient is on the do-not-email list; not an error. */
  outcome: 'sent' | 'failed' | 'bounced' | 'retry' | 'skipped' | 'suppressed'
  errorMessage?: string
}

/**
 * Some early-generation emails were stored with the raw LLM JSON response as
 * the subject (and body). Extract the real values if that's the case.
 */
function extractEmailFields(raw: { subject: string; body: string }): { subject: string; body: string } {
  const s = raw.subject.trim()
  if (!s.startsWith('{')) return raw
  try {
    const parsed = JSON.parse(s) as Record<string, unknown>
    const subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : ''
    const body = typeof parsed.body === 'string' ? parsed.body.trim() : ''
    if (subject && body) return { subject, body }
  } catch {
    // not JSON — use as-is
  }
  return raw
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

  // Do-not-email gate. Must run before the send and before Safe Delivery
  // redirection, so it is the intended recipient that is checked — not the
  // testing mailbox. Cancels the queue item rather than failing it: a
  // suppressed address is a permanent, correct stop, not a retryable error.
  if (await isSalesEmailSuppressed(supabase, intendedRecipient)) {
    await cancelSalesEmailSendQueueItem(supabase, queue.id)
    return {
      queueId: queue.id,
      outcome: 'suppressed',
      errorMessage: `Recipient is on the do-not-email list (${intendedRecipient}).`,
    }
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
    const { subject, body: rawBody } = extractEmailFields({
      subject: email.subject,
      body: email.body,
    })

    // Render body text to HTML without signature so brochure images can be
    // injected between the body paragraphs and the sign-off.
    const outbound = await resolveOutboundEmailWithAttachments(supabase, {
      generatedEmailId: email.id,
      body: renderSalesEmailContentHtml({ body: rawBody, signature: null }),
    })

    const attachments = isFeatureEnabled(settings, SALES_ENGINE_SETTING_KEYS.ATTACHMENT_SENDING_ENABLED)
      ? outbound.attachments
      : []

    // Mandatory unsubscribe facility + sender identification on every message
    // (Spam Act 2003 s17/s18). Not behind a feature flag — only the open pixel is.
    const { openUrl, unsubscribeUrl } = buildEngagementTrackingUrls({
      campaignId: queue.campaign_id,
      contactId: queue.contact_id,
      generatedEmailId: email.id,
    })

    // Sequence position drives only how prominent the unsubscribe control is,
    // never whether it exists. followup_count is incremented by
    // onOutboundEmailSent, which is itself gated on EMAIL_TRACKING_ENABLED — so
    // with tracking off this stays at 1 and every email uses the discreet link.
    // That degrades safely (link is always compliant); revisit if the counter
    // moves out from behind the tracking flag.
    const engagement = await getSalesContactEngagement(supabase, {
      contact_id: queue.contact_id,
      campaign_id: queue.campaign_id,
    })
    const emailNumber = (engagement?.followup_count ?? 0) + 1

    // Append signature AFTER attachments so brochure images sit between
    // the body content and the sign-off.
    let body = appendSalesEmailSignature(outbound.body)

    if (isFeatureEnabled(settings, SALES_ENGINE_SETTING_KEYS.EMAIL_TRACKING_ENABLED)) {
      body = injectTrackingPixel(body, openUrl)
    }

    body = buildComplianceFooter({
      body,
      unsubscribeUrl,
      recipientEmail: intendedRecipient,
      presentation: resolveUnsubscribePresentation(emailNumber),
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
    body = wrapSalesEmailDocument(body, {
      previewText: subject,
      logoUrl: appUrl ? `${appUrl}/nbe-logo.png` : undefined,
    })

    const result = await sendEmail({
      recipient: actualRecipient,
      subject,
      body,
      provider: queue.provider,
      attachments,
      unsubscribeUrl,
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
      // A hard bounce suppresses the address globally: continuing to send to a
      // dead mailbox damages domain reputation, and rediscovery would otherwise
      // re-add it as a fresh contact row.
      await addSalesEmailSuppression(supabase, {
        email_address: intendedRecipient,
        reason: 'bounced',
        contact_id: queue.contact_id,
        campaign_id: queue.campaign_id,
        notes: classification.failureReason,
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
