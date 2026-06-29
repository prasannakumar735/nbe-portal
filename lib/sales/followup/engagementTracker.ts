import type { SupabaseClient } from '@supabase/supabase-js'
import { cancelScheduledFollowup, scheduleFollowup } from '@/lib/sales/followup/followupScheduler'
import {
  getActiveQueuedSalesFollowupForContact,
  markSalesFollowupQueueSent,
} from '@/lib/sales/repositories/salesFollowupQueueRepository'
import {
  patchSalesContactEngagement,
  recordSalesContactEmailSentAt,
} from '@/lib/sales/repositories/salesContactEngagementRepository'
import { getSalesGeneratedEmailById } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import type { SalesContactEngagementKey } from '@/lib/sales/types/contactEngagement.types'

export type OutboundEmailSentInput = SalesContactEngagementKey & {
  generatedEmailId: string
  sentAt?: string
}

export async function ensureEngagementAfterOutboundSend(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
  sentAt?: string,
): Promise<void> {
  await recordSalesContactEmailSentAt(supabase, key, sentAt)
}

export async function onOutboundEmailSent(
  supabase: SupabaseClient,
  input: OutboundEmailSentInput,
): Promise<void> {
  const sentAt = input.sentAt
  await ensureEngagementAfterOutboundSend(
    supabase,
    { contact_id: input.contact_id, campaign_id: input.campaign_id },
    sentAt,
  )

  const email = await getSalesGeneratedEmailById(supabase, input.generatedEmailId)
  const isFollowup = email?.parent_generated_email_id != null

  if (isFollowup) {
    const activeFollowup = await getActiveQueuedSalesFollowupForContact(
      supabase,
      input.contact_id,
      input.campaign_id,
    )
    if (activeFollowup) {
      await markSalesFollowupQueueSent(supabase, activeFollowup.id)
    }
    return
  }

  await scheduleFollowup(supabase, {
    generatedEmailId: input.generatedEmailId,
    contactId: input.contact_id,
    campaignId: input.campaign_id,
    sentAt,
  })
}

export async function markReplyDetected(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
  repliedAt?: string,
): Promise<void> {
  const at = repliedAt ?? new Date().toISOString()
  await patchSalesContactEngagement(supabase, key, {
    reply_detected: true,
    last_reply_at: at,
  })
  await cancelScheduledFollowup(supabase, {
    contactId: key.contact_id,
    campaignId: key.campaign_id,
  })
}

export async function markOpened(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
): Promise<void> {
  await patchSalesContactEngagement(supabase, key, { opened: true })
}

export async function markClicked(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
): Promise<void> {
  await patchSalesContactEngagement(supabase, key, { clicked: true })
}

export async function markBounceDetected(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
): Promise<void> {
  await patchSalesContactEngagement(supabase, key, { bounce_detected: true })
  await cancelScheduledFollowup(supabase, {
    contactId: key.contact_id,
    campaignId: key.campaign_id,
  })
}

export async function markUnsubscribed(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
): Promise<void> {
  await patchSalesContactEngagement(supabase, key, { unsubscribed: true })
  await cancelScheduledFollowup(supabase, {
    contactId: key.contact_id,
    campaignId: key.campaign_id,
  })
}
