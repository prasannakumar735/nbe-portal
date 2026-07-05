import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesEmailMessageDirection, SalesEmailMessageImportSource } from '@/lib/sales/constants/emailMessageDirections'
import type {
  SalesEmailMessage,
  SalesEmailMessageInsert,
} from '@/lib/sales/types/replyManagement.types'

const TABLE = 'sales_email_messages'

function parseRecipients(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is string => typeof v === 'string')
}

function mapRow(row: Record<string, unknown>): SalesEmailMessage {
  return {
    id: String(row.id),
    thread_id: String(row.thread_id),
    direction: row.direction as SalesEmailMessageDirection,
    generated_email_id: row.generated_email_id != null ? String(row.generated_email_id) : null,
    delivery_log_id: row.delivery_log_id != null ? String(row.delivery_log_id) : null,
    graph_message_id: row.graph_message_id != null ? String(row.graph_message_id) : null,
    internet_message_id: row.internet_message_id != null ? String(row.internet_message_id) : null,
    conversation_id: row.conversation_id != null ? String(row.conversation_id) : null,
    in_reply_to: row.in_reply_to != null ? String(row.in_reply_to) : null,
    sender: row.sender != null ? String(row.sender) : null,
    recipients: parseRecipients(row.recipients),
    subject: String(row.subject ?? ''),
    body_html: row.body_html != null ? String(row.body_html) : null,
    body_text: row.body_text != null ? String(row.body_text) : null,
    received_at: row.received_at != null ? String(row.received_at) : null,
    import_source: row.import_source as SalesEmailMessageImportSource,
    created_at: String(row.created_at),
  }
}

export async function getSalesEmailMessageById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesEmailMessage | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getSalesEmailMessageByGraphMessageId(
  supabase: SupabaseClient,
  graphMessageId: string,
): Promise<SalesEmailMessage | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('graph_message_id', graphMessageId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesEmailMessagesByThreadId(
  supabase: SupabaseClient,
  threadId: string,
): Promise<SalesEmailMessage[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('thread_id', threadId)
    .order('received_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function insertSalesEmailMessage(
  supabase: SupabaseClient,
  row: SalesEmailMessageInsert,
): Promise<SalesEmailMessage | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      thread_id: row.thread_id,
      direction: row.direction,
      generated_email_id: row.generated_email_id ?? null,
      delivery_log_id: row.delivery_log_id ?? null,
      graph_message_id: row.graph_message_id ?? null,
      internet_message_id: row.internet_message_id ?? null,
      conversation_id: row.conversation_id ?? null,
      in_reply_to: row.in_reply_to ?? null,
      sender: row.sender ?? null,
      recipients: row.recipients ?? [],
      subject: row.subject,
      body_html: row.body_html ?? null,
      body_text: row.body_text ?? null,
      received_at: row.received_at ?? null,
      import_source: row.import_source ?? 'graph_delta',
    })
    .select('*')
    .maybeSingle()

  if (error) {
    if (error.code === '23505' && row.graph_message_id) {
      return getSalesEmailMessageByGraphMessageId(supabase, row.graph_message_id)
    }
    throw error
  }
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function findSalesEmailMessageByInternetMessageId(
  supabase: SupabaseClient,
  internetMessageId: string,
): Promise<SalesEmailMessage | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('internet_message_id', internetMessageId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}
