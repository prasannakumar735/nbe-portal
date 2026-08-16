import type { SalesEmailDeliveryLogStatus } from '@/lib/sales/constants/emailDeliveryLogStatuses'

export type { SalesEmailDeliveryLogStatus } from '@/lib/sales/constants/emailDeliveryLogStatuses'

export { SALES_EMAIL_DELIVERY_LOG_STATUSES } from '@/lib/sales/constants/emailDeliveryLogStatuses'

export type SalesEmailDeliveryLog = {
  id: string
  queue_id: string
  provider: string
  status: SalesEmailDeliveryLogStatus
  external_message_id: string | null
  failure_reason: string | null
  latency_ms: number
  intended_recipient_email: string | null
  actual_recipient_email: string | null
  safe_delivery_mode: boolean
  created_at: string
}

export type SalesEmailDeliveryLogInsert = {
  queue_id: string
  provider: string
  status: SalesEmailDeliveryLogStatus
  external_message_id?: string | null
  failure_reason?: string | null
  latency_ms?: number
  intended_recipient_email?: string | null
  actual_recipient_email?: string | null
  safe_delivery_mode?: boolean
}
