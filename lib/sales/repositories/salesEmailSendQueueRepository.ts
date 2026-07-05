import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesEmailSendQueue,
  SalesEmailSendQueueInsert,
  SalesEmailSendQueueListOptions,
} from '@/lib/sales/types/emailSendQueue.types'
import type { SalesEmailSendQueueStatus } from '@/lib/sales/constants/emailSendQueueStatuses'

const TABLE = 'sales_email_send_queue'

export class SalesEmailSendQueueError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SalesEmailSendQueueError'
  }
}

function mapRow(row: Record<string, unknown>): SalesEmailSendQueue {
  return {
    id: String(row.id),
    generated_email_id: String(row.generated_email_id),
    campaign_id: String(row.campaign_id),
    contact_id: String(row.contact_id),
    provider: String(row.provider),
    status: row.status as SalesEmailSendQueueStatus,
    attempts: Number(row.attempts ?? 0),
    scheduled_at: String(row.scheduled_at),
    sent_at: row.sent_at != null ? String(row.sent_at) : null,
    created_at: String(row.created_at),
  }
}

export async function getSalesEmailSendQueueById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesEmailSendQueue | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getSalesEmailSendQueueByGeneratedEmailId(
  supabase: SupabaseClient,
  generatedEmailId: string,
): Promise<SalesEmailSendQueue | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('generated_email_id', generatedEmailId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesEmailSendQueue(
  supabase: SupabaseClient,
  options?: SalesEmailSendQueueListOptions,
): Promise<SalesEmailSendQueue[]> {
  let query = supabase.from(TABLE).select('*').order('scheduled_at', { ascending: true })

  if (options?.campaignId) {
    query = query.eq('campaign_id', options.campaignId)
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

export async function listQueuedSalesEmailSendItems(
  supabase: SupabaseClient,
  limit: number,
): Promise<SalesEmailSendQueue[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function createSalesEmailSendQueueItem(
  supabase: SupabaseClient,
  row: SalesEmailSendQueueInsert,
): Promise<SalesEmailSendQueue> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      generated_email_id: row.generated_email_id,
      campaign_id: row.campaign_id,
      contact_id: row.contact_id,
      provider: row.provider,
      status: row.status ?? 'queued',
      scheduled_at: row.scheduled_at ?? new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

/** queued → sending (optimistic lock). Increments attempts. */
export async function claimSalesEmailSendQueueItem(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesEmailSendQueue | null> {
  const existing = await getSalesEmailSendQueueById(supabase, id)
  if (!existing || existing.status !== 'queued') {
    return null
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'sending',
      attempts: existing.attempts + 1,
    })
    .eq('id', id)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function markSalesEmailSendQueueSent(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesEmailSendQueue> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'sent',
      sent_at: now,
    })
    .eq('id', id)
    .eq('status', 'sending')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new SalesEmailSendQueueError('Send queue item could not be marked sent.')
  return mapRow(data as Record<string, unknown>)
}

export async function markSalesEmailSendQueueFailed(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesEmailSendQueue> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'failed' })
    .eq('id', id)
    .in('status', ['sending', 'queued'])
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new SalesEmailSendQueueError('Send queue item could not be marked failed.')
  return mapRow(data as Record<string, unknown>)
}

export async function markSalesEmailSendQueueBounced(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesEmailSendQueue> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'bounced' })
    .eq('id', id)
    .in('status', ['sending', 'queued'])
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new SalesEmailSendQueueError('Send queue item could not be marked bounced.')
  return mapRow(data as Record<string, unknown>)
}

export async function requeueSalesEmailSendQueueItem(
  supabase: SupabaseClient,
  id: string,
  scheduledAt?: string,
): Promise<SalesEmailSendQueue | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'queued',
      scheduled_at: scheduledAt ?? new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'sending')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function reactivateCancelledSalesEmailSendQueueItem(
  supabase: SupabaseClient,
  id: string,
  input: { provider: string; scheduledAt?: string },
): Promise<SalesEmailSendQueue | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'queued',
      provider: input.provider,
      scheduled_at: input.scheduledAt ?? new Date().toISOString(),
      sent_at: null,
    })
    .eq('id', id)
    .eq('status', 'cancelled')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function cancelSalesEmailSendQueueItem(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesEmailSendQueue | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('status', ['queued', 'failed'])
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

/** Reset `sending` rows to `queued` (e.g. after worker timeout). Returns count updated. */
export async function requeueStuckSalesEmailSendQueueItems(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'queued' })
    .eq('status', 'sending')
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

/** Manual resend: failed or cancelled → queued (resets attempts). */
export async function prepareManualResendSalesEmailSendQueueItem(
  supabase: SupabaseClient,
  id: string,
  scheduledAt?: string,
): Promise<SalesEmailSendQueue | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: 'queued',
      attempts: 0,
      scheduled_at: scheduledAt ?? new Date().toISOString(),
      sent_at: null,
    })
    .eq('id', id)
    .in('status', ['failed', 'cancelled'])
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export type SalesEmailSendQueueStatusCounts = Record<SalesEmailSendQueueStatus, number>

export async function countSalesEmailSendQueueByStatus(
  supabase: SupabaseClient,
  options?: { campaignId?: string },
): Promise<SalesEmailSendQueueStatusCounts> {
  const counts: SalesEmailSendQueueStatusCounts = {
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    bounced: 0,
    cancelled: 0,
  }

  let query = supabase.from(TABLE).select('status')
  if (options?.campaignId) {
    query = query.eq('campaign_id', options.campaignId)
  }
  const { data, error } = await query
  if (error) throw error
  for (const row of data ?? []) {
    const status = (row as { status: SalesEmailSendQueueStatus }).status
    if (status in counts) counts[status] += 1
  }
  return counts
}
