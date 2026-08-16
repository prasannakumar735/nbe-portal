/** Delivery attempt outcome (Phase 6). */

export const SALES_EMAIL_DELIVERY_LOG_STATUSES = [
  'success',
  'failed',
  'bounced',
  'provider_error',
] as const

export type SalesEmailDeliveryLogStatus = (typeof SALES_EMAIL_DELIVERY_LOG_STATUSES)[number]
