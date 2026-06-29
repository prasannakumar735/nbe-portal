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
