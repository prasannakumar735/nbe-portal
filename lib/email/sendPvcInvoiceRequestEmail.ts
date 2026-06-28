import nodemailer from 'nodemailer'
import type { QuoteData } from '@/lib/types/quote.types'

export async function sendPvcInvoiceRequestEmail(options: {
  managerDisplayName: string
  quoteData: QuoteData
  pdfBuffer: Uint8Array
  fileName: string
  customerLabel: string
}): Promise<void> {
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

  const body = [
    'hi team,',
    '',
    `${options.managerDisplayName} marked this order as shipped or installed, please raise an invoice if not raised already. please do check with manager`,
    '',
    `Customer: ${options.customerLabel}`,
    '',
    'thanks',
    'nbe portal team',
  ].join('\n')

  await transporter.sendMail({
    from,
    to: 'accounts@nbeaustralia.com.au',
    subject: `PVC strip order — invoice request (${options.customerLabel})`,
    text: body,
    attachments: [
      {
        filename: options.fileName,
        content: Buffer.from(options.pdfBuffer),
        contentType: 'application/pdf',
      },
    ],
  })
}
