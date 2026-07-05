import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesEmailDeliveryLog,
  SalesEmailDeliveryLogInsert,
} from '@/lib/sales/types/emailDeliveryLog.types'

const TABLE = 'sales_email_delivery_logs'

function mapRow(row: Record<string, unknown>): SalesEmailDeliveryLog {
  return {
    id: String(row.id),
    queue_id: String(row.queue_id),
    provider: String(row.provider),
    status: row.status as SalesEmailDeliveryLog['status'],
    external_message_id:
      row.external_message_id != null ? String(row.external_message_id) : null,
    failure_reason: row.failure_reason != null ? String(row.failure_reason) : null,
    latency_ms: Number(row.latency_ms ?? 0),
    created_at: String(row.created_at),
  }
}

export async function listSalesEmailDeliveryLogsByQueueId(
  supabase: SupabaseClient,
  queueId: string,
): Promise<SalesEmailDeliveryLog[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('queue_id', queueId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function createSalesEmailDeliveryLog(
  supabase: SupabaseClient,
  row: SalesEmailDeliveryLogInsert,
): Promise<SalesEmailDeliveryLog> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      queue_id: row.queue_id,
      provider: row.provider,
      status: row.status,
      external_message_id: row.external_message_id ?? null,
      failure_reason: row.failure_reason ?? null,
      latency_ms: row.latency_ms ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export type SalesDeliveryCorrelationContext = {
  deliveryLogId: string
  queueId: string
  campaignId: string
  contactId: string
  generatedEmailId: string
}

/** Matches outbound `X-NBE-Correlation-Id` stored on delivery logs as `external_message_id`. */
export async function findSalesDeliveryContextByCorrelationId(
  supabase: SupabaseClient,
  correlationId: string,
): Promise<SalesDeliveryCorrelationContext | null> {
  const id = correlationId.trim()
  if (!id) return null

  const { data: logRow, error: logErr } = await supabase
    .from(TABLE)
    .select('id, queue_id, external_message_id, status')
    .eq('external_message_id', id)
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (logErr) throw logErr
  if (!logRow) return null

  const queueId = String((logRow as { queue_id: string }).queue_id)
  const { data: queueRow, error: queueErr } = await supabase
    .from('sales_email_send_queue')
    .select('id, campaign_id, contact_id, generated_email_id')
    .eq('id', queueId)
    .maybeSingle()
  if (queueErr) throw queueErr
  if (!queueRow) return null

  const q = queueRow as {
    id: string
    campaign_id: string
    contact_id: string
    generated_email_id: string
  }

  return {
    deliveryLogId: String((logRow as { id: string }).id),
    queueId: q.id,
    campaignId: q.campaign_id,
    contactId: q.contact_id,
    generatedEmailId: q.generated_email_id,
  }
}

export async function listRecentSalesEmailDeliveryFailures(
  supabase: SupabaseClient,
  options?: { campaignId?: string; limit?: number },
): Promise<SalesEmailDeliveryLog[]> {
  const limit = options?.limit ?? 20
  let query = supabase
    .from(TABLE)
    .select('*')
    .neq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options?.campaignId) {
    const { data: queueRows, error: queueErr } = await supabase
      .from('sales_email_send_queue')
      .select('id')
      .eq('campaign_id', options.campaignId)
    if (queueErr) throw queueErr
    const ids = (queueRows ?? []).map((r) => String((r as { id: string }).id))
    if (ids.length === 0) return []
    query = query.in('queue_id', ids)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}
