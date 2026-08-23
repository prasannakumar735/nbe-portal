import { sendMailViaGraph } from '@/lib/graph/sendMail'

export async function sendPvcQuoteToManager(params: {
  senderName: string
  senderEmail: string
  recipientEmails: string[]
  emailBody: string
  pdfBytes: Buffer | null
  pdfFileName: string
}): Promise<void> {
  const subject = buildSubject(params.emailBody)

  // Graph sendMail takes a single `to` string; for multiple recipients join with semicolons
  const to = params.recipientEmails.join('; ')

  await sendMailViaGraph({
    to,
    subject,
    bodyText: params.emailBody,
    attachments: params.pdfBytes
      ? [
          {
            name: params.pdfFileName,
            contentType: 'application/pdf',
            contentBytes: params.pdfBytes.toString('base64'),
          },
        ]
      : [],
  })
}

/** Extract a subject line from the first non-empty line of the body, fallback to generic. */
function buildSubject(body: string): string {
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.toLowerCase().startsWith('please find attached')) {
      const match = trimmed.match(/quotation for (.+?)\.?$/)
      if (match?.[1]) return `PVC Strip Curtain Quote — ${match[1].trim()}`
    }
  }
  return 'PVC Strip Curtain Quotation'
}
