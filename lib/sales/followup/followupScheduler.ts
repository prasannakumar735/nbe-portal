import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesFollowupSequence } from '@/lib/sales/types/followupSequence.types'
import type { SalesContactEngagementKey } from '@/lib/sales/types/contactEngagement.types'
import { getSalesContactEngagement } from '@/lib/sales/repositories/salesContactEngagementRepository'
import {
  cancelScheduledSalesFollowupsForContact,
  createSalesFollowupQueueItem,
  listSalesFollowupQueue,
  markSalesFollowupQueueCancelled,
} from '@/lib/sales/repositories/salesFollowupQueueRepository'
import { getSalesFollowupSequenceByCampaignId } from '@/lib/sales/repositories/salesFollowupSequenceRepository'

const DEFAULT_SEQUENCE: Pick<
  SalesFollowupSequence,
  'enabled' | 'max_followups' | 'followup_delay_days' | 'stop_on_reply'
> = {
  enabled: true,
  max_followups: 3,
  followup_delay_days: 3,
  stop_on_reply: true,
}

export type ScheduleFollowupInput = {
  generatedEmailId: string
  contactId: string
  campaignId: string
  /** ISO timestamp of successful send; defaults to now. */
  sentAt?: string
  /** Override computed schedule time (ISO). */
  scheduledAt?: string
}

export type ScheduleFollowupResult = {
  scheduled: boolean
  reason: string
  queueId?: string
  followupNumber?: number
  scheduledAt?: string
}

export type GetNextFollowupDateInput = {
  campaignId: string
  /** Anchor for delay calculation (defaults to now). */
  fromDate?: Date
}

export type CancelScheduledFollowupInput =
  | { queueId: string }
  | {
      contactId: string
      campaignId: string
      /** When omitted, cancels all scheduled rows for the contact/campaign. */
      followupNumber?: number
    }

export type CancelScheduledFollowupResult = {
  cancelled: boolean
  cancelledCount: number
  reason?: string
}

function resolveSequenceRules(
  sequence: SalesFollowupSequence | null,
): Pick<SalesFollowupSequence, 'enabled' | 'max_followups' | 'followup_delay_days' | 'stop_on_reply'> {
  if (!sequence) return DEFAULT_SEQUENCE
  return sequence
}

function addUtcDays(base: Date, days: number): Date {
  const next = new Date(base.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code: unknown }).code) : ''
  if (code === '23505') return true
  const message = 'message' in error ? String((error as { message: unknown }).message) : ''
  return message.includes('duplicate') || message.includes('unique')
}

/**
 * Next follow-up run time from campaign sequence delay (UTC calendar days).
 */
export async function getNextFollowupDate(
  supabase: SupabaseClient,
  input: GetNextFollowupDateInput,
): Promise<Date> {
  const sequence = await getSalesFollowupSequenceByCampaignId(supabase, input.campaignId)
  const delayDays = resolveSequenceRules(sequence).followup_delay_days
  const base = input.fromDate ?? new Date()
  return addUtcDays(base, delayDays)
}

/**
 * Schedule the next follow-up after a successful outbound send.
 */
export async function scheduleFollowup(
  supabase: SupabaseClient,
  input: ScheduleFollowupInput,
): Promise<ScheduleFollowupResult> {
  const sequence = await getSalesFollowupSequenceByCampaignId(supabase, input.campaignId)
  const rules = resolveSequenceRules(sequence)

  if (!rules.enabled) {
    return { scheduled: false, reason: 'Follow-up sequence disabled.' }
  }

  const engagementKey: SalesContactEngagementKey = {
    contact_id: input.contactId,
    campaign_id: input.campaignId,
  }
  const engagement = await getSalesContactEngagement(supabase, engagementKey)

  if (engagement?.reply_detected || engagement?.last_reply_at) {
    if (rules.stop_on_reply) {
      return { scheduled: false, reason: 'Reply detected; follow-ups stopped.' }
    }
  }
  if (engagement?.unsubscribed) {
    return { scheduled: false, reason: 'Contact unsubscribed.' }
  }
  if (engagement?.bounce_detected) {
    return { scheduled: false, reason: 'Bounce detected.' }
  }

  const sentFollowupCount = engagement?.followup_count ?? 0
  if (sentFollowupCount >= rules.max_followups) {
    return { scheduled: false, reason: 'Maximum follow-ups already completed.' }
  }

  const followupNumber = sentFollowupCount + 1
  const sentAt = input.sentAt ? new Date(input.sentAt) : new Date()
  const scheduledAtDate = input.scheduledAt
    ? new Date(input.scheduledAt)
    : addUtcDays(sentAt, rules.followup_delay_days)
  const scheduledAt = scheduledAtDate.toISOString()

  try {
    const row = await createSalesFollowupQueueItem(supabase, {
      generated_email_id: input.generatedEmailId,
      contact_id: input.contactId,
      campaign_id: input.campaignId,
      followup_number: followupNumber,
      scheduled_at: scheduledAt,
      status: 'scheduled',
    })
    return {
      scheduled: true,
      reason: `Follow-up ${followupNumber} scheduled.`,
      queueId: row.id,
      followupNumber,
      scheduledAt,
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        scheduled: false,
        reason: `Active follow-up already scheduled for step ${followupNumber}.`,
      }
    }
    throw error
  }
}

/**
 * Cancel scheduled follow-up queue row(s) (status → cancelled).
 */
export async function cancelScheduledFollowup(
  supabase: SupabaseClient,
  input: CancelScheduledFollowupInput,
): Promise<CancelScheduledFollowupResult> {
  if ('queueId' in input) {
    const cancelled = await markSalesFollowupQueueCancelled(supabase, input.queueId)
    if (!cancelled) {
      return {
        cancelled: false,
        cancelledCount: 0,
        reason: 'Follow-up queue item not found or not in scheduled status.',
      }
    }
    return { cancelled: true, cancelledCount: 1 }
  }

  if (input.followupNumber != null) {
    const rows = await listSalesFollowupQueue(supabase, {
      contactId: input.contactId,
      campaignId: input.campaignId,
      status: 'scheduled',
    })
    const targets = rows.filter((r) => r.followup_number === input.followupNumber)
    if (targets.length === 0) {
      return {
        cancelled: false,
        cancelledCount: 0,
        reason: 'No scheduled follow-up found for this step.',
      }
    }
    let cancelledCount = 0
    for (const row of targets) {
      const updated = await markSalesFollowupQueueCancelled(supabase, row.id)
      if (updated) cancelledCount += 1
    }
    return {
      cancelled: cancelledCount > 0,
      cancelledCount,
      reason: cancelledCount === 0 ? 'Follow-up could not be cancelled.' : undefined,
    }
  }

  const cancelledCount = await cancelScheduledSalesFollowupsForContact(
    supabase,
    input.contactId,
    input.campaignId,
  )
  return {
    cancelled: cancelledCount > 0,
    cancelledCount,
    reason: cancelledCount === 0 ? 'No scheduled follow-ups to cancel.' : undefined,
  }
}
