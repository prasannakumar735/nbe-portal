import type { SalesContactEngagement } from '@/lib/sales/types/contactEngagement.types'
import type { SalesFollowupSequence } from '@/lib/sales/types/followupSequence.types'

export type FollowupDecisionInput = {
  engagement: SalesContactEngagement | null
  sequence: SalesFollowupSequence | null
  followupNumber: number
  scheduledAt: string
  sentFollowupCount: number
  now?: Date
}

export type FollowupDecisionResult = {
  shouldSend: boolean
  reason: string
}

const DEFAULT_SEQUENCE: Pick<
  SalesFollowupSequence,
  'enabled' | 'max_followups' | 'followup_delay_days' | 'stop_on_reply'
> = {
  enabled: true,
  max_followups: 3,
  followup_delay_days: 3,
  stop_on_reply: true,
}

function resolveSequenceRules(
  sequence: SalesFollowupSequence | null,
): Pick<SalesFollowupSequence, 'enabled' | 'max_followups' | 'followup_delay_days' | 'stop_on_reply'> {
  if (!sequence) return DEFAULT_SEQUENCE
  return sequence
}

export function shouldSendFollowup(input: FollowupDecisionInput): FollowupDecisionResult {
  const rules = resolveSequenceRules(input.sequence)
  const now = input.now ?? new Date()
  const scheduledAt = new Date(input.scheduledAt)

  if (!rules.enabled) {
    return { shouldSend: false, reason: 'Follow-up sequence is disabled for this campaign.' }
  }

  const engagement = input.engagement

  if (engagement?.reply_detected) {
    return { shouldSend: false, reason: 'Recipient reply detected.' }
  }

  if (engagement?.unsubscribed) {
    return { shouldSend: false, reason: 'Contact unsubscribed.' }
  }

  if (engagement?.bounce_detected) {
    return { shouldSend: false, reason: 'Previous delivery bounce detected.' }
  }

  if (input.followupNumber > rules.max_followups) {
    return { shouldSend: false, reason: 'Maximum follow-ups reached for this contact.' }
  }

  if (input.sentFollowupCount >= rules.max_followups) {
    return { shouldSend: false, reason: 'Maximum follow-ups already sent.' }
  }

  if (Number.isNaN(scheduledAt.getTime())) {
    return { shouldSend: false, reason: 'Invalid follow-up schedule timestamp.' }
  }

  if (scheduledAt.getTime() > now.getTime()) {
    return { shouldSend: false, reason: 'Follow-up delay period has not elapsed.' }
  }

  return { shouldSend: true, reason: 'No reply; delay elapsed; eligible for follow-up.' }
}
