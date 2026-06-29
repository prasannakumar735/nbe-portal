import {
  isEmailSendProviderId,
  type EmailSendProviderId,
} from '@/lib/sales/constants/emailSendProviders'

export type SendEmailInput = {
  recipient: string
  subject: string
  body: string
  provider: string
}

export type SendEmailResult = {
  externalMessageId: string
  latencyMs: number
}

function assertSendProvider(provider: string): EmailSendProviderId {
  if (!isEmailSendProviderId(provider)) {
    throw new Error(`Unknown email send provider: ${provider}`)
  }
  return provider
}

async function sendViaProviderStub(provider: EmailSendProviderId): Promise<never> {
  throw new Error(`${provider} email sender not implemented yet`)
}

/**
 * Provider-agnostic outbound send entry (Microsoft 365, SMTP, SendGrid, Mailgun).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = assertSendProvider(input.provider)
  const recipient = input.recipient.trim()
  const subject = input.subject.trim()
  const body = input.body.trim()

  if (!recipient) {
    throw new Error('Invalid recipient: email address is required.')
  }
  if (!subject || !body) {
    throw new Error('Invalid email content: subject and body are required.')
  }

  const startedAt = Date.now()
  await sendViaProviderStub(provider)
  const latencyMs = Math.max(0, Date.now() - startedAt)

  return {
    externalMessageId: '',
    latencyMs,
  }
}
