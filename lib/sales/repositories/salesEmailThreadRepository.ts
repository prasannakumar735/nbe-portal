import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesEmailThreadStatus } from '@/lib/sales/constants/emailThreadStatuses'
import type {
  SalesEmailThread,
  SalesEmailThreadInsert,
  SalesEmailThreadListOptions,
  SalesEmailThreadPatch,
} from '@/lib/sales/types/replyManagement.types'

const TABLE = 'sales_email_threads'

function mapRow(row: Record<string, unknown>): SalesEmailThread {
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    contact_id: String(row.contact_id),
    business_id: row.business_id != null ? String(row.business_id) : null,
    opportunity_id: row.opportunity_id != null ? String(row.opportunity_id) : null,
    graph_conversation_id:
      row.graph_conversation_id != null ? String(row.graph_conversation_id) : null,
    graph_thread_id: row.graph_thread_id != null ? String(row.graph_thread_id) : null,
    status: row.status as SalesEmailThreadStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function getSalesEmailThreadById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesEmailThread | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getSalesEmailThreadByGraphConversationId(
  supabase: SupabaseClient,
  graphConversationId: string,
): Promise<SalesEmailThread | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('graph_conversation_id', graphConversationId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getSalesEmailThreadByCampaignContact(
  supabase: SupabaseClient,
  campaignId: string,
  contactId: string,
): Promise<SalesEmailThread | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesEmailThreads(
  supabase: SupabaseClient,
  options?: SalesEmailThreadListOptions,
): Promise<SalesEmailThread[]> {
  let query = supabase.from(TABLE).select('*').order('updated_at', { ascending: false })
  if (options?.campaignId) query = query.eq('campaign_id', options.campaignId)
  if (options?.contactId) query = query.eq('contact_id', options.contactId)
  if (options?.status) query = query.eq('status', options.status)
  if (options?.limit != null) query = query.limit(options.limit)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function createSalesEmailThread(
  supabase: SupabaseClient,
  row: SalesEmailThreadInsert,
): Promise<SalesEmailThread> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      campaign_id: row.campaign_id,
      contact_id: row.contact_id,
      business_id: row.business_id ?? null,
      opportunity_id: row.opportunity_id ?? null,
      graph_conversation_id: row.graph_conversation_id ?? null,
      graph_thread_id: row.graph_thread_id ?? null,
      status: row.status ?? 'open',
      updated_at: now,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSalesEmailThread(
  supabase: SupabaseClient,
  id: string,
  patch: SalesEmailThreadPatch,
): Promise<SalesEmailThread> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status != null) payload.status = patch.status
  if (patch.business_id !== undefined) payload.business_id = patch.business_id
  if (patch.opportunity_id !== undefined) payload.opportunity_id = patch.opportunity_id
  if (patch.graph_conversation_id !== undefined) {
    payload.graph_conversation_id = patch.graph_conversation_id
  }
  if (patch.graph_thread_id !== undefined) payload.graph_thread_id = patch.graph_thread_id

  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}
