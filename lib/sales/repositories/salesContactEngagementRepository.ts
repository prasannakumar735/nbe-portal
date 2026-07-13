import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesContactEngagement,
  SalesContactEngagementInsert,
  SalesContactEngagementKey,
} from '@/lib/sales/types/contactEngagement.types'

const TABLE = 'sales_contact_engagement'

export class SalesContactEngagementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesContactEngagementError'
  }
}

function mapRow(row: Record<string, unknown>): SalesContactEngagement {
  return {
    id: String(row.id),
    contact_id: String(row.contact_id),
    campaign_id: String(row.campaign_id),
    last_email_sent_at: row.last_email_sent_at != null ? String(row.last_email_sent_at) : null,
    last_reply_at: row.last_reply_at != null ? String(row.last_reply_at) : null,
    reply_detected: Boolean(row.reply_detected),
    delivered: Boolean(row.delivered),
    opened: Boolean(row.opened),
    clicked: Boolean(row.clicked),
    unsubscribed: Boolean(row.unsubscribed),
    bounce_detected: Boolean(row.bounce_detected),
    followup_count: Number(row.followup_count ?? 0),
    created_at: String(row.created_at),
  }
}

export async function getSalesContactEngagement(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
): Promise<SalesContactEngagement | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('contact_id', key.contact_id)
    .eq('campaign_id', key.campaign_id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function upsertSalesContactEngagement(
  supabase: SupabaseClient,
  row: SalesContactEngagementInsert,
): Promise<SalesContactEngagement> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        contact_id: row.contact_id,
        campaign_id: row.campaign_id,
        last_email_sent_at: row.last_email_sent_at ?? null,
      },
      { onConflict: 'contact_id,campaign_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function patchSalesContactEngagement(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
  patch: Partial<
    Pick<
      SalesContactEngagement,
      | 'last_email_sent_at'
      | 'last_reply_at'
      | 'reply_detected'
      | 'delivered'
      | 'opened'
      | 'clicked'
      | 'unsubscribed'
      | 'bounce_detected'
      | 'followup_count'
    >
  >,
): Promise<SalesContactEngagement> {
  const existing = await getSalesContactEngagement(supabase, key)
  if (!existing) {
    return upsertSalesContactEngagement(supabase, {
      contact_id: key.contact_id,
      campaign_id: key.campaign_id,
      ...patch,
    })
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('contact_id', key.contact_id)
    .eq('campaign_id', key.campaign_id)
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function incrementSalesContactFollowupCount(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
): Promise<SalesContactEngagement> {
  const existing = await getSalesContactEngagement(supabase, key)
  const next = (existing?.followup_count ?? 0) + 1
  return patchSalesContactEngagement(supabase, key, { followup_count: next })
}

export async function recordSalesContactEmailSentAt(
  supabase: SupabaseClient,
  key: SalesContactEngagementKey,
  sentAt?: string,
): Promise<SalesContactEngagement> {
  const at = sentAt ?? new Date().toISOString()
  return patchSalesContactEngagement(supabase, key, { last_email_sent_at: at })
}

export async function listSalesContactEngagementByCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<SalesContactEngagement[]> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('campaign_id', campaignId)
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}
