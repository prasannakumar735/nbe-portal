import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesOfferAttachment,
  SalesOfferAttachmentInsert,
} from '@/lib/sales/types/emailAttachment.types'

const TABLE = 'sales_offer_attachments'

function mapRow(row: Record<string, unknown>): SalesOfferAttachment {
  return {
    id: String(row.id),
    offer_type_id: String(row.offer_type_id),
    storage_path: String(row.storage_path),
    file_name: String(row.file_name),
    content_type: String(row.content_type),
    byte_size: Number(row.byte_size),
    sort_order: Number(row.sort_order ?? 0),
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at),
  }
}

export async function listSalesOfferAttachmentsByOfferTypeId(
  supabase: SupabaseClient,
  offerTypeId: string,
): Promise<SalesOfferAttachment[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('offer_type_id', offerTypeId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function getSalesOfferAttachmentById(
  supabase: SupabaseClient,
  attachmentId: string,
): Promise<SalesOfferAttachment | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', attachmentId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function createSalesOfferAttachment(
  supabase: SupabaseClient,
  input: SalesOfferAttachmentInsert,
): Promise<SalesOfferAttachment> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      offer_type_id: input.offer_type_id,
      storage_path: input.storage_path,
      file_name: input.file_name,
      content_type: input.content_type,
      byte_size: input.byte_size,
      sort_order: input.sort_order ?? 0,
      created_by: input.created_by ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function deleteSalesOfferAttachment(
  supabase: SupabaseClient,
  attachmentId: string,
): Promise<SalesOfferAttachment | null> {
  const existing = await getSalesOfferAttachmentById(supabase, attachmentId)
  if (!existing) return null
  const { error } = await supabase.from(TABLE).delete().eq('id', attachmentId)
  if (error) throw error
  return existing
}

export async function countSalesOfferAttachmentsByOfferTypeId(
  supabase: SupabaseClient,
  offerTypeId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('offer_type_id', offerTypeId)
  if (error) throw error
  return count ?? 0
}
