import type { EmailSendProviderId } from '@/lib/sales/constants/emailSendProviders'

export type SendEmailInput = {
  recipient: string
  subject: string
  body: string
  provider: string
}

export type SendEmailResult = {
  externalMessageId: string
  latencyMs: number
  provider?: EmailSendProviderId
  httpStatus?: number
}
