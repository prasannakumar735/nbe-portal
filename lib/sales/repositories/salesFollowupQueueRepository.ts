import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesFollowupQueueStatus } from '@/lib/sales/constants/followupQueueStatuses'
import type {
  SalesFollowupQueue,
  SalesFollowupQueueInsert,
  SalesFollowupQueueListOptions,
} from '@/lib/sales/types/followupQueue.types'

const TABLE = 'sales_followup_queue'

export class SalesFollowupQueueError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesFollowupQueueError'
  }
}

function mapRow(row: Record<string, unknown>): SalesFollowupQueue {
  return {
    id: String(row.id),
    generated_email_id: String(row.generated_email_id),
    contact_id: String(row.contact_id),
    campaign_id: String(row.campaign_id),
    followup_number: Number(row.followup_number),
    scheduled_at: String(row.scheduled_at),
    status: row.status as SalesFollowupQueueStatus,
    generation_provider:
      row.generation_provider != null ? String(row.generation_provider) : null,
    processing_started_at:
      row.processing_started_at != null ? String(row.processing_started_at) : null,
    result_generated_email_id:
      row.result_generated_email_id != null ? String(row.result_generated_email_id) : null,
    created_at: String(row.created_at),
  }
}

export async function getSalesFollowupQueueById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesFollowupQueue | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesFollowupQueue(
  supabase: SupabaseClient,
  options?: SalesFollowupQueueListOptions,
): Promise<SalesFollowupQueue[]> {
  let query = supabase.from(TABLE).select('*').order('scheduled_at', { ascending: true })

  if (options?.campaignId) {
    query = query.eq('campaign_id', options.campaignId)
  }
  if (options?.contactId) {
    query = query.eq('contact_id', options.contactId)
  }
  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.limit != null) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function listDueScheduledSalesFollowupQueue(
  supabase: SupabaseClient,
  limit: number,
): Promise<SalesFollowupQueue[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function countSentSalesFollowupsForContact(
  supabase: SupabaseClient,
  contactId: string,
  campaignId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .eq('campaign_id', campaignId)
    .eq('status', 'sent')
  if (error) throw error
  return count ?? 0
}

export async function createSalesFollowupQueueItem(
  supabase: SupabaseClient,
  row: SalesFollowupQueueInsert,
): Promise<SalesFollowupQueue> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      generated_email_id: row.generated_email_id,
      contact_id: row.contact_id,
      campaign_id: row.campaign_id,
      followup_number: row.followup_number,
      scheduled_at: row.scheduled_at,
      status: row.status ?? 'scheduled',
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

/** scheduled → generating (single atomic claim; concurrent dispatchers lose the race). */
export async function claimSalesFollowupQueueItem(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesFollowupQueue | null> {
  const processingStartedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'generating',
      processing_started_at: processingStartedAt,
    })
    .eq('id', id)
    .eq('status', 'scheduled')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function markSalesFollowupQueueStatus(
  supabase: SupabaseClient,
  id: string,
  fromStatuses: SalesFollowupQueueStatus[],
  toStatus: SalesFollowupQueueStatus,
): Promise<SalesFollowupQueue | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: toStatus })
    .eq('id', id)
    .in('status', fromStatuses)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function markSalesFollowupQueueQueued(
  supabase: SupabaseClient,
  id: string,
  generationProvider?: string,
): Promise<SalesFollowupQueue | null> {
  const patch: { status: SalesFollowupQueueStatus; generation_provider?: string } = {
    status: 'queued',
  }
  if (generationProvider?.trim()) {
    patch.generation_provider = generationProvider.trim()
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .eq('status', 'generating')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function markSalesFollowupQueueAwaitingReview(
  supabase: SupabaseClient,
  id: string,
  input: { resultGeneratedEmailId: string; generationProvider?: string },
): Promise<SalesFollowupQueue | null> {
  const patch: {
    status: SalesFollowupQueueStatus
    result_generated_email_id: string
    generation_provider?: string
  } = {
    status: 'awaiting_review',
    result_generated_email_id: input.resultGeneratedEmailId,
  }
  if (input.generationProvider?.trim()) {
    patch.generation_provider = input.generationProvider.trim()
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .eq('status', 'generating')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getSalesFollowupQueueByResultEmailId(
  supabase: SupabaseClient,
  resultGeneratedEmailId: string,
): Promise<SalesFollowupQueue | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('result_generated_email_id', resultGeneratedEmailId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function markSalesFollowupQueueSent(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesFollowupQueue | null> {
  return markSalesFollowupQueueStatus(supabase, id, ['queued', 'awaiting_review'], 'sent')
}

export async function markSalesFollowupQueueSkipped(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesFollowupQueue | null> {
  return markSalesFollowupQueueStatus(
    supabase,
    id,
    ['scheduled', 'generating'],
    'skipped',
  )
}

export async function markSalesFollowupQueueCancelled(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesFollowupQueue | null> {
  return markSalesFollowupQueueStatus(supabase, id, ['scheduled'], 'cancelled')
}

export async function cancelScheduledSalesFollowupsForContact(
  supabase: SupabaseClient,
  contactId: string,
  campaignId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'cancelled' })
    .eq('contact_id', contactId)
    .eq('campaign_id', campaignId)
    .eq('status', 'scheduled')
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

export async function getActiveQueuedSalesFollowupForContact(
  supabase: SupabaseClient,
  contactId: string,
  campaignId: string,
): Promise<SalesFollowupQueue | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('contact_id', contactId)
    .eq('campaign_id', campaignId)
    .eq('status', 'queued')
    .order('followup_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}
