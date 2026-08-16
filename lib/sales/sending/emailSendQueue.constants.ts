import type { EmailSendProviderId } from '@/lib/sales/constants/emailSendProviders'

export const DEFAULT_EMAIL_SEND_PROVIDER: EmailSendProviderId = 'microsoft365'

export const MAX_EMAIL_SEND_ATTEMPTS = 4

export type EmailSendQueueOptions = {
  provider?: EmailSendProviderId
  scheduledAt?: string
}

export type EmailSendWorkerOptions = {
  maxAttempts?: number
}
