import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSalesBrochureSignedUrl,
  downloadSalesBrochureBytes,
} from '@/lib/sales/attachments/salesBrochureStorage'
import { isImageSalesEmailAttachmentMimeType } from '@/lib/sales/constants/salesEmailAttachmentLimits'
import { listEnabledSalesGeneratedEmailAttachments } from '@/lib/sales/repositories/salesGeneratedEmailAttachmentRepository'
import {
  buildOutboundAttachmentContentId,
  enrichEmailBodyWithAttachments,
  type AttachmentBodyLink,
} from '@/lib/sales/sending/emailAttachmentBodyEnrichment'
import type { OutboundEmailAttachmentInput } from '@/lib/sales/sending/emailSenderAdapter.types'

const PDF_SIGNED_URL_SECONDS = 60 * 60 * 24 * 30

export type ResolvedOutboundEmailContent = {
  body: string
  attachments: OutboundEmailAttachmentInput[]
}

export async function resolveOutboundEmailWithAttachments(
  supabase: SupabaseClient,
  input: { generatedEmailId: string; body: string },
): Promise<ResolvedOutboundEmailContent> {
  const rows = await listEnabledSalesGeneratedEmailAttachments(supabase, input.generatedEmailId)
  if (rows.length === 0) {
    return { body: input.body, attachments: [] }
  }

  const pdfLinks: AttachmentBodyLink[] = []
  const attachments: OutboundEmailAttachmentInput[] = []

  for (const row of rows) {
    const bytes = await downloadSalesBrochureBytes(row.storage_path)
    const contentBytes = bytes.toString('base64')
    const isImage = isImageSalesEmailAttachmentMimeType(row.content_type)
    const contentId = isImage ? buildOutboundAttachmentContentId(row.id) : undefined

    attachments.push({
      fileName: row.file_name,
      contentType: row.content_type,
      contentBytes,
      contentId,
      isInline: isImage,
      attachmentRowId: row.id,
    })

    if (row.content_type.split(';')[0]?.trim().toLowerCase() === 'application/pdf') {
      const signedUrl = await createSalesBrochureSignedUrl(row.storage_path, PDF_SIGNED_URL_SECONDS)
      pdfLinks.push({ fileName: row.file_name, signedUrl })
    }
  }

  const body = enrichEmailBodyWithAttachments({
    body: input.body,
    attachments,
    pdfLinks,
  })

  return { body, attachments }
}
