import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesEngagementEventSource, SalesEngagementEventType } from '@/lib/sales/constants/engagementEventTypes'
import {
  markBounceDetected,
  markClicked,
  markOpened,
  markReplyDetected,
  markUnsubscribed,
} from '@/lib/sales/followup/engagementTracker'
import { patchSalesContactEngagement } from '@/lib/sales/repositories/salesContactEngagementRepository'
import { insertSalesEngagementEvent } from '@/lib/sales/repositories/salesEngagementEventRepository'
import { getSalesGeneratedEmailById } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import type { SalesEngagementEvent } from '@/lib/sales/types/engagementEvent.types'

export type RecordEngagementEventInput = {
  campaignId: string
  contactId: string
  eventType: SalesEngagementEventType
  source: SalesEngagementEventSource
  generatedEmailId?: string | null
  queueId?: string | null
  occurredAt?: string
  metadata?: Record<string, unknown>
  idempotencyKey?: string | null
}

async function resolvePromptContext(
  supabase: SupabaseClient,
  generatedEmailId: string | null | undefined,
): Promise<{
  prompt_library_id: string | null
  prompt_name: string | null
  prompt_version: number | null
}> {
  if (!generatedEmailId) {
    return { prompt_library_id: null, prompt_name: null, prompt_version: null }
  }
  const email = await getSalesGeneratedEmailById(supabase, generatedEmailId)
  if (!email) {
    return { prompt_library_id: null, prompt_name: null, prompt_version: null }
  }
  return {
    prompt_library_id: email.prompt_library_id,
    prompt_name: email.prompt_name,
    prompt_version: email.prompt_version,
  }
}

async function applyContactEngagementSummary(
  supabase: SupabaseClient,
  input: RecordEngagementEventInput,
): Promise<void> {
  const key = { contact_id: input.contactId, campaign_id: input.campaignId }
  switch (input.eventType) {
    case 'delivered':
      await patchSalesContactEngagement(supabase, key, { delivered: true })
      break
    case 'opened':
      await markOpened(supabase, key)
      break
    case 'clicked':
      await markClicked(supabase, key)
      break
    case 'replied':
      await markReplyDetected(supabase, key, input.occurredAt)
      break
    case 'bounced':
      await markBounceDetected(supabase, key)
      break
    case 'unsubscribed':
      await markUnsubscribed(supabase, key)
      break
    default:
      break
  }
}

/** Append immutable engagement event and update contact summary (idempotent when key provided). */
export async function recordCampaignEngagementEvent(
  supabase: SupabaseClient,
  input: RecordEngagementEventInput,
): Promise<SalesEngagementEvent | null> {
  const prompt = await resolvePromptContext(supabase, input.generatedEmailId)

  const event = await insertSalesEngagementEvent(supabase, {
    campaign_id: input.campaignId,
    contact_id: input.contactId,
    event_type: input.eventType,
    source: input.source,
    generated_email_id: input.generatedEmailId ?? null,
    queue_id: input.queueId ?? null,
    prompt_library_id: prompt.prompt_library_id,
    prompt_name: prompt.prompt_name,
    prompt_version: prompt.prompt_version,
    occurred_at: input.occurredAt,
    metadata: input.metadata ?? {},
    idempotency_key: input.idempotencyKey ?? null,
  })

  if (event) {
    await applyContactEngagementSummary(supabase, input)
  }

  return event
}
