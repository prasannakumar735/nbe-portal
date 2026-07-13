import {
  isEmailSendProviderId,
  type EmailSendProviderId,
} from '@/lib/sales/constants/emailSendProviders'
import { sendOutboundEmailViaMicrosoft365 } from '@/lib/sales/sending/microsoft365EmailSender'
import type { SendEmailInput, SendEmailResult } from '@/lib/sales/sending/emailSenderAdapter.types'

export type { SendEmailInput, SendEmailResult } from '@/lib/sales/sending/emailSenderAdapter.types'

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

  const normalized: SendEmailInput = {
    recipient,
    subject,
    body,
    provider,
    attachments: input.attachments,
  }

  switch (provider) {
    case 'microsoft365':
      return sendOutboundEmailViaMicrosoft365(normalized)
    case 'smtp':
    case 'sendgrid':
    case 'mailgun':
      return sendViaProviderStub(provider)
    default:
      return sendViaProviderStub(provider)
  }
}
