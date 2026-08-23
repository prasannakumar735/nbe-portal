import nodemailer from 'nodemailer'

export async function sendPvcQuoteToManager(params: {
  senderName: string
  senderEmail: string
  recipientEmails: string[]
  emailBody: string
  pdfBytes: Buffer | null
  pdfFileName: string
}): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass || !from) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.')
  }

  const to = params.recipientEmails.join(', ')
  const subject = buildSubject(params.emailBody)

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from: `"${params.senderName}" <${from}>`,
    to,
    replyTo: params.senderEmail,
    subject,
    text: params.emailBody,
    attachments: params.pdfBytes
      ? [
          {
            filename: params.pdfFileName,
            content: params.pdfBytes,
            contentType: 'application/pdf',
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
