import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesGeneratedEmailAttachment,
  SalesGeneratedEmailAttachmentInsert,
} from '@/lib/sales/types/emailAttachment.types'

const TABLE = 'sales_generated_email_attachments'

function mapRow(row: Record<string, unknown>): SalesGeneratedEmailAttachment {
  return {
    id: String(row.id),
    generated_email_id: String(row.generated_email_id),
    storage_path: String(row.storage_path),
    file_name: String(row.file_name),
    content_type: String(row.content_type),
    byte_size: Number(row.byte_size),
    source: row.source === 'offer' ? 'offer' : 'upload',
    offer_attachment_id: row.offer_attachment_id != null ? String(row.offer_attachment_id) : null,
    enabled: Boolean(row.enabled),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at),
  }
}

export async function listSalesGeneratedEmailAttachments(
  supabase: SupabaseClient,
  generatedEmailId: string,
): Promise<SalesGeneratedEmailAttachment[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('generated_email_id', generatedEmailId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function listEnabledSalesGeneratedEmailAttachments(
  supabase: SupabaseClient,
  generatedEmailId: string,
): Promise<SalesGeneratedEmailAttachment[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('generated_email_id', generatedEmailId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function getSalesGeneratedEmailAttachmentById(
  supabase: SupabaseClient,
  attachmentId: string,
): Promise<SalesGeneratedEmailAttachment | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', attachmentId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createSalesGeneratedEmailAttachment(
  supabase: SupabaseClient,
  input: SalesGeneratedEmailAttachmentInsert,
): Promise<SalesGeneratedEmailAttachment> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      generated_email_id: input.generated_email_id,
      storage_path: input.storage_path,
      file_name: input.file_name,
      content_type: input.content_type,
      byte_size: input.byte_size,
      source: input.source,
      offer_attachment_id: input.offer_attachment_id ?? null,
      enabled: input.enabled ?? true,
      sort_order: input.sort_order ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function createSalesGeneratedEmailAttachments(
  supabase: SupabaseClient,
  inputs: SalesGeneratedEmailAttachmentInsert[],
): Promise<SalesGeneratedEmailAttachment[]> {
  if (inputs.length === 0) return []
  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      inputs.map((input) => ({
        generated_email_id: input.generated_email_id,
        storage_path: input.storage_path,
        file_name: input.file_name,
        content_type: input.content_type,
        byte_size: input.byte_size,
        source: input.source,
        offer_attachment_id: input.offer_attachment_id ?? null,
        enabled: input.enabled ?? true,
        sort_order: input.sort_order ?? 0,
      })),
    )
    .select('*')
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function updateSalesGeneratedEmailAttachmentEnabled(
  supabase: SupabaseClient,
  attachmentId: string,
  enabled: boolean,
): Promise<SalesGeneratedEmailAttachment | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ enabled })
    .eq('id', attachmentId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function deleteSalesGeneratedEmailAttachment(
  supabase: SupabaseClient,
  attachmentId: string,
): Promise<SalesGeneratedEmailAttachment | null> {
  const existing = await getSalesGeneratedEmailAttachmentById(supabase, attachmentId)
  if (!existing) return null
  const { error } = await supabase.from(TABLE).delete().eq('id', attachmentId)
  if (error) throw error
  return existing
}
