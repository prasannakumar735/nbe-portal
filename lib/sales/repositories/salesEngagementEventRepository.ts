import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesEngagementEvent,
  SalesEngagementEventInsert,
} from '@/lib/sales/types/engagementEvent.types'
import type { SalesEngagementEventType } from '@/lib/sales/constants/engagementEventTypes'

const TABLE = 'sales_engagement_events'

function mapRow(row: Record<string, unknown>): SalesEngagementEvent {
  const meta = row.metadata
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    contact_id: String(row.contact_id),
    generated_email_id: row.generated_email_id != null ? String(row.generated_email_id) : null,
    queue_id: row.queue_id != null ? String(row.queue_id) : null,
    prompt_library_id: row.prompt_library_id != null ? String(row.prompt_library_id) : null,
    prompt_name: row.prompt_name != null ? String(row.prompt_name) : null,
    prompt_version: row.prompt_version != null ? Number(row.prompt_version) : null,
    event_type: row.event_type as SalesEngagementEvent['event_type'],
    source: row.source as SalesEngagementEvent['source'],
    occurred_at: String(row.occurred_at),
    metadata:
      meta != null && typeof meta === 'object' && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    idempotency_key: row.idempotency_key != null ? String(row.idempotency_key) : null,
    created_at: String(row.created_at),
  }
}

export async function insertSalesEngagementEvent(
  supabase: SupabaseClient,
  row: SalesEngagementEventInsert,
): Promise<SalesEngagementEvent | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      campaign_id: row.campaign_id,
      contact_id: row.contact_id,
      event_type: row.event_type,
      source: row.source,
      generated_email_id: row.generated_email_id ?? null,
      queue_id: row.queue_id ?? null,
      prompt_library_id: row.prompt_library_id ?? null,
      prompt_name: row.prompt_name ?? null,
      prompt_version: row.prompt_version ?? null,
      occurred_at: row.occurred_at ?? new Date().toISOString(),
      metadata: row.metadata ?? {},
      idempotency_key: row.idempotency_key ?? null,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    if (error.code === '23505' && row.idempotency_key) {
      const { data: existing } = await supabase
        .from(TABLE)
        .select('*')
        .eq('idempotency_key', row.idempotency_key)
        .maybeSingle()
      return existing ? mapRow(existing as Record<string, unknown>) : null
    }
    throw error
  }
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function countSalesEngagementEventsByCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<Record<SalesEngagementEventType, number>> {
  const counts: Record<SalesEngagementEventType, number> = {
    delivered: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    bounced: 0,
    unsubscribed: 0,
  }
  const { data, error } = await supabase.from(TABLE).select('event_type').eq('campaign_id', campaignId)
  if (error) throw error
  for (const row of data ?? []) {
    const t = (row as { event_type: SalesEngagementEventType }).event_type
    if (t in counts) counts[t] += 1
  }
  return counts
}

export type PromptEngagementRollupRow = {
  prompt_name: string
  prompt_version: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  unsubscribed: number
}

export async function rollupSalesEngagementEventsByPrompt(
  supabase: SupabaseClient,
  options?: { campaignId?: string },
): Promise<PromptEngagementRollupRow[]> {
  let query = supabase
    .from(TABLE)
    .select('prompt_name, prompt_version, event_type')
    .not('prompt_name', 'is', null)

  if (options?.campaignId) {
    query = query.eq('campaign_id', options.campaignId)
  }

  const { data, error } = await query
  if (error) throw error

  const map = new Map<string, PromptEngagementRollupRow>()
  for (const row of data ?? []) {
    const r = row as {
      prompt_name: string
      prompt_version: number
      event_type: SalesEngagementEventType
    }
    if (!r.prompt_name || r.prompt_version == null) continue
    const key = `${r.prompt_name}::${r.prompt_version}`
    let bucket = map.get(key)
    if (!bucket) {
      bucket = {
        prompt_name: r.prompt_name,
        prompt_version: Number(r.prompt_version),
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0,
        unsubscribed: 0,
      }
      map.set(key, bucket)
    }
    if (r.event_type === 'delivered') bucket.delivered += 1
    else if (r.event_type === 'opened') bucket.opened += 1
    else if (r.event_type === 'clicked') bucket.clicked += 1
    else if (r.event_type === 'replied') bucket.replied += 1
    else if (r.event_type === 'bounced') bucket.bounced += 1
    else if (r.event_type === 'unsubscribed') bucket.unsubscribed += 1
  }
  return [...map.values()]
}
