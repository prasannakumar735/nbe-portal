import type { SupabaseClient } from '@supabase/supabase-js'
import { SALES_BROCHURE_BUCKET } from '@/lib/storage/salesBrochureBucket'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { listSalesOfferAttachmentsByOfferTypeId } from '@/lib/sales/repositories/salesOfferAttachmentRepository'
import { createSalesGeneratedEmailAttachments } from '@/lib/sales/repositories/salesGeneratedEmailAttachmentRepository'
import type { SalesGeneratedEmailAttachmentInsert } from '@/lib/sales/types/emailAttachment.types'

export function mapOfferAttachmentsForGeneratedEmail(
  generatedEmailId: string,
  offerRows: { id: string; storage_path: string; file_name: string; content_type: string; byte_size: number; sort_order: number }[],
): SalesGeneratedEmailAttachmentInsert[] {
  return offerRows.map((row, index) => ({
    generated_email_id: generatedEmailId,
    storage_path: row.storage_path,
    file_name: row.file_name,
    content_type: row.content_type,
    byte_size: row.byte_size,
    source: 'offer' as const,
    offer_attachment_id: row.id,
    enabled: true,
    sort_order: row.sort_order ?? index,
  }))
}

/**
 * Copy offer-type brochure library rows onto a newly generated email (snapshot).
 */
export async function copyOfferAttachmentsToGeneratedEmail(
  supabase: SupabaseClient,
  input: { generatedEmailId: string; offerTypeId: string },
): Promise<void> {
  const offerRows = await listSalesOfferAttachmentsByOfferTypeId(supabase, input.offerTypeId)
  if (offerRows.length === 0) return

  const inserts = mapOfferAttachmentsForGeneratedEmail(input.generatedEmailId, offerRows)

  await createSalesGeneratedEmailAttachments(supabase, inserts)
}

export function buildSalesBrochureStoragePath(prefix: string, fileName: string): string {
  const safeBase = fileName.replace(/[^\w.\-() ]+/g, '_').slice(0, 120) || 'file'
  const ext = safeBase.includes('.') ? safeBase.split('.').pop() : 'bin'
  return `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
}

export async function uploadSalesBrochureBytes(input: {
  path: string
  bytes: Buffer
  contentType: string
}): Promise<void> {
  const service = createServiceRoleClient()
  const { error } = await service.storage.from(SALES_BROCHURE_BUCKET).upload(input.path, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  })
  if (error) throw new Error(error.message)
}

export async function downloadSalesBrochureBytes(storagePath: string): Promise<Buffer> {
  const service = createServiceRoleClient()
  const { data, error } = await service.storage.from(SALES_BROCHURE_BUCKET).download(storagePath)
  if (error) throw new Error(error.message)
  const ab = await data.arrayBuffer()
  return Buffer.from(ab)
}

export async function deleteSalesBrochureObject(storagePath: string): Promise<void> {
  const service = createServiceRoleClient()
  const { error } = await service.storage.from(SALES_BROCHURE_BUCKET).remove([storagePath])
  if (error) throw new Error(error.message)
}

export async function createSalesBrochureSignedUrl(
  storagePath: string,
  expiresInSeconds: number,
): Promise<string | null> {
  const service = createServiceRoleClient()
  const { data, error } = await service.storage
    .from(SALES_BROCHURE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error) throw new Error(error.message)
  return data?.signedUrl ?? null
}
