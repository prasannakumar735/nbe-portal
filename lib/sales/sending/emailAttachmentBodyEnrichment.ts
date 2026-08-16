import { isImageSalesEmailAttachmentMimeType } from '@/lib/sales/constants/salesEmailAttachmentLimits'
import { escapeHtml, looksLikeHtml } from '@/lib/sales/sending/emailBodyFormat'
import type { OutboundEmailAttachmentInput } from '@/lib/sales/sending/emailSenderAdapter.types'

export type AttachmentBodyLink = {
  fileName: string
  signedUrl: string | null
}

export function buildOutboundAttachmentContentId(attachmentRowId: string): string {
  const safe = attachmentRowId.replace(/[^a-zA-Z0-9-]/g, '')
  return `nbe-${safe}@nbe.local`
}

export function enrichEmailBodyWithAttachments(input: {
  body: string
  attachments: OutboundEmailAttachmentInput[]
  pdfLinks: AttachmentBodyLink[]
}): string {
  const { body, attachments, pdfLinks } = input
  if (attachments.length === 0) return body

  const images = attachments.filter((a) => isImageSalesEmailAttachmentMimeType(a.contentType))
  const pdfLinkByName = new Map(pdfLinks.map((l) => [l.fileName, l.signedUrl]))

  const pdfs = attachments.filter((a) => a.contentType.split(';')[0]?.trim().toLowerCase() === 'application/pdf')
  const htmlMode = looksLikeHtml(body)

  const lines: string[] = []
  if (htmlMode && images.length > 0) {
    lines.push(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;background-color:#f8f7fb;border:1px solid #e5e7eb;border-radius:8px;">',
      '<tr><td style="padding:16px;">',
      '<p style="margin:0 0 10px;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">Product brochure</p>',
    )
    for (const img of images) {
      const cid = img.contentId ?? buildOutboundAttachmentContentId(img.attachmentRowId ?? img.fileName)
      lines.push(
        `<img src="cid:${escapeHtml(cid)}" alt="NBE product brochure" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:4px;" />`,
      )
    }
    lines.push('</td></tr></table>')
  }

  if (pdfs.length > 0) {
    if (htmlMode) {
      lines.push(
        '<p style="margin:0 0 12px;font-size:13px;color:#374151;font-family:Arial,Helvetica,sans-serif;">Further product information is attached as a PDF brochure.</p>',
      )
      for (const pdf of pdfs) {
        const url = pdfLinkByName.get(pdf.fileName)
        if (url) {
          lines.push(
            `<p style="margin:0 0 12px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background-color:#5B21B6;color:#ffffff;text-decoration:none;border-radius:4px;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Download brochure (PDF)</a></p>`,
          )
        }
      }
    }
  }

  if (!htmlMode && (pdfs.length > 0 || images.length > 0)) {
    const textLines: string[] = ['', '--- Attachments ---']
    for (const pdf of pdfs) {
      const url = pdfLinkByName.get(pdf.fileName)
      textLines.push(url ? `Attached: ${pdf.fileName} (${url})` : `Attached: ${pdf.fileName}`)
    }
    for (const img of images) {
      textLines.push(`Image attached: ${img.fileName}`)
    }
    return `${body}\n${textLines.join('\n')}`
  }

  if (lines.length === 0) return body

  const block = lines.join('\n')
  return `${body}\n<div data-nbe-attachments="true" style="margin-top:8px;">\n${block}\n</div>`
}
