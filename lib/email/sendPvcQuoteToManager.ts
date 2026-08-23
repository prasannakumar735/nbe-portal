import { Resend } from 'resend'

export async function sendPvcQuoteToManager(params: {
  senderName: string
  senderEmail: string
  recipientEmails: string[]
  emailBody: string
  pdfBytes: Buffer | null
  pdfFileName: string
}): Promise<void> {
  const key = (process.env.RESEND_API_KEY ?? '').trim()
  if (!key) {
    throw new Error('Email is not configured. Set RESEND_API_KEY in environment variables.')
  }

  const resend = new Resend(key)
  const subject = buildSubject(params.emailBody)

  const attachments = params.pdfBytes
    ? [
        {
          filename: params.pdfFileName,
          content: params.pdfBytes,
        },
      ]
    : []

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'NBE Portal <noreply@nbeaustralia.com.au>',
    to: params.recipientEmails,
    reply_to: params.senderEmail,
    subject,
    text: params.emailBody,
    attachments,
  })

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`)
  }
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
