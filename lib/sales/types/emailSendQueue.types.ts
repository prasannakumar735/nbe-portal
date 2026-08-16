import type { SalesEmailSendQueueStatus } from '@/lib/sales/constants/emailSendQueueStatuses'

export type { SalesEmailSendQueueStatus } from '@/lib/sales/constants/emailSendQueueStatuses'

export { SALES_EMAIL_SEND_QUEUE_STATUSES } from '@/lib/sales/constants/emailSendQueueStatuses'

export type SalesEmailSendQueue = {
  id: string
  generated_email_id: string
  campaign_id: string
  contact_id: string
  provider: string
  status: SalesEmailSendQueueStatus
  attempts: number
  scheduled_at: string
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type SalesEmailSendQueueInsert = {
  generated_email_id: string
  campaign_id: string
  contact_id: string
  provider: string
  status?: SalesEmailSendQueueStatus
  scheduled_at?: string
}

export type SalesEmailSendQueueListOptions = {
  campaignId?: string
  status?: SalesEmailSendQueueStatus
  limit?: number
}
