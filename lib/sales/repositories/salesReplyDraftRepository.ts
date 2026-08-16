import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesReplyDraftStatus } from '@/lib/sales/constants/replyDraftStatuses'
import type {
  SalesReplyDraft,
  SalesReplyDraftInsert,
  SalesReplyDraftPatch,
} from '@/lib/sales/types/replyManagement.types'

const TABLE = 'sales_reply_drafts'

function mapRow(row: Record<string, unknown>): SalesReplyDraft {
  return {
    id: String(row.id),
    thread_id: String(row.thread_id),
    in_reply_to_message_id:
      row.in_reply_to_message_id != null ? String(row.in_reply_to_message_id) : null,
    subject: String(row.subject),
    body: String(row.body),
    status: row.status as SalesReplyDraftStatus,
    prompt_library_id: row.prompt_library_id != null ? String(row.prompt_library_id) : null,
    prompt_name: row.prompt_name != null ? String(row.prompt_name) : null,
    prompt_version: row.prompt_version != null ? Number(row.prompt_version) : null,
    reviewed_by: row.reviewed_by != null ? String(row.reviewed_by) : null,
    reviewed_at: row.reviewed_at != null ? String(row.reviewed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function getSalesReplyDraftById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesReplyDraft | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSalesReplyDraftsByThreadId(
  supabase: SupabaseClient,
  threadId: string,
): Promise<SalesReplyDraft[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('thread_id', threadId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function createSalesReplyDraft(
  supabase: SupabaseClient,
  row: SalesReplyDraftInsert,
): Promise<SalesReplyDraft> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      thread_id: row.thread_id,
      in_reply_to_message_id: row.in_reply_to_message_id ?? null,
      subject: row.subject,
      body: row.body,
      status: row.status ?? 'draft',
      prompt_library_id: row.prompt_library_id ?? null,
      prompt_name: row.prompt_name ?? null,
      prompt_version: row.prompt_version ?? null,
      updated_at: now,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSalesReplyDraft(
  supabase: SupabaseClient,
  id: string,
  patch: SalesReplyDraftPatch,
): Promise<SalesReplyDraft> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.subject != null) payload.subject = patch.subject
  if (patch.body != null) payload.body = patch.body
  if (patch.status != null) payload.status = patch.status
  if (patch.reviewed_by !== undefined) payload.reviewed_by = patch.reviewed_by
  if (patch.reviewed_at !== undefined) payload.reviewed_at = patch.reviewed_at

  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}
