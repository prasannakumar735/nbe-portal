/** Outbound send queue lifecycle (Phase 6). */

export const SALES_EMAIL_SEND_QUEUE_STATUSES = [
  'queued',
  'sending',
  'sent',
  'failed',
  'bounced',
  'cancelled',
] as const

export type SalesEmailSendQueueStatus = (typeof SALES_EMAIL_SEND_QUEUE_STATUSES)[number]
