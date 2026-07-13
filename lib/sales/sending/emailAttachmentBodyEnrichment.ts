import { isImageSalesEmailAttachmentMimeType } from '@/lib/sales/constants/salesEmailAttachmentLimits'
import type { OutboundEmailAttachmentInput } from '@/lib/sales/sending/emailSenderAdapter.types'

export type AttachmentBodyLink = {
  fileName: string
  signedUrl: string | null
}

function looksLikeHtml(body: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(body)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
    for (const img of images) {
      const cid = img.contentId ?? buildOutboundAttachmentContentId(img.attachmentRowId ?? img.fileName)
      lines.push(
        `<p><img src="cid:${escapeHtml(cid)}" alt="${escapeHtml(img.fileName)}" style="max-width:100%;height:auto;" /></p>`,
      )
    }
  }

  if (pdfs.length > 0) {
    if (htmlMode) {
      lines.push('<p><strong>Brochures</strong></p><ul>')
      for (const pdf of pdfs) {
        const url = pdfLinkByName.get(pdf.fileName)
        const label = escapeHtml(pdf.fileName)
        if (url) {
          lines.push(`<li>Attached: <a href="${escapeHtml(url)}">${label}</a></li>`)
        } else {
          lines.push(`<li>Attached: ${label}</li>`)
        }
      }
      lines.push('</ul>')
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
  return `${body}\n<hr />\n<div data-nbe-attachments="true">\n${block}\n</div>`
}
