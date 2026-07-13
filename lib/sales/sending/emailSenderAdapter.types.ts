import type { EmailSendProviderId } from '@/lib/sales/constants/emailSendProviders'

export type OutboundEmailAttachmentInput = {
  fileName: string
  contentType: string
  /** Base64-encoded file bytes */
  contentBytes: string
  contentId?: string
  isInline?: boolean
  attachmentRowId?: string
}

export type SendEmailInput = {
  recipient: string
  subject: string
  body: string
  provider: string
  attachments?: OutboundEmailAttachmentInput[]
}

export type SendEmailResult = {
  externalMessageId: string
  latencyMs: number
  provider?: EmailSendProviderId
  httpStatus?: number
}
