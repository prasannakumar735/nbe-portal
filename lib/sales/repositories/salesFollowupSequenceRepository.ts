import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesFollowupSequence,
  SalesFollowupSequenceInsert,
  SalesFollowupSequenceUpdate,
} from '@/lib/sales/types/followupSequence.types'

const TABLE = 'sales_followup_sequences'

export class SalesFollowupSequenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesFollowupSequenceError'
  }
}

function mapRow(row: Record<string, unknown>): SalesFollowupSequence {
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    enabled: Boolean(row.enabled),
    max_followups: Number(row.max_followups ?? 3),
    followup_delay_days: Number(row.followup_delay_days ?? 3),
    stop_on_reply: Boolean(row.stop_on_reply),
    created_at: String(row.created_at),
  }
}

export async function getSalesFollowupSequenceByCampaignId(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<SalesFollowupSequence | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createSalesFollowupSequence(
  supabase: SupabaseClient,
  row: SalesFollowupSequenceInsert,
): Promise<SalesFollowupSequence> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      campaign_id: row.campaign_id,
      enabled: row.enabled ?? true,
      max_followups: row.max_followups ?? 3,
      followup_delay_days: row.followup_delay_days ?? 3,
      stop_on_reply: row.stop_on_reply ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSalesFollowupSequence(
  supabase: SupabaseClient,
  campaignId: string,
  patch: SalesFollowupSequenceUpdate,
): Promise<SalesFollowupSequence | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('campaign_id', campaignId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function upsertSalesFollowupSequence(
  supabase: SupabaseClient,
  row: SalesFollowupSequenceInsert,
): Promise<SalesFollowupSequence> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        campaign_id: row.campaign_id,
        enabled: row.enabled ?? true,
        max_followups: row.max_followups ?? 3,
        followup_delay_days: row.followup_delay_days ?? 3,
        stop_on_reply: row.stop_on_reply ?? true,
      },
      { onConflict: 'campaign_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}
