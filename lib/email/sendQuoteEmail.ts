import nodemailer from 'nodemailer'
import type { QuoteData } from '@/lib/types/quote.types'

function currency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value)
}

export async function sendQuoteEmail(
  quoteData: QuoteData,
  pdfBuffer: Uint8Array,
  fileName: string,
): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass || !from) {
    throw new Error('Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from,
    to: 'service@nbeaustralia.com.au',
    subject: 'New PVC Strip Door Quote Generated',
    text: [
      'A new PVC strip door quote has been generated from the NBE Portal.',
      '',
      `Width: ${quoteData.input.width_mm} mm`,
      `Height: ${quoteData.input.height_mm} mm`,
      `Strip Type: ${quoteData.input.strip_type}`,
      `Number of Strips: ${quoteData.calculated.strip_count}`,
      `Final Quote Price: ${currency(quoteData.calculated.final_quote_price)}`,
    ].join('\n'),
    attachments: [
      {
        filename: fileName,
        content: Buffer.from(pdfBuffer),
        contentType: 'application/pdf',
      },
    ],
  })
}
