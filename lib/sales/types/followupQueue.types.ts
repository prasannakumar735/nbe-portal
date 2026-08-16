import type { SalesFollowupQueueStatus } from '@/lib/sales/constants/followupQueueStatuses'

export type SalesFollowupQueue = {
  id: string
  generated_email_id: string
  contact_id: string
  campaign_id: string
  followup_number: number
  scheduled_at: string
  status: SalesFollowupQueueStatus
  generation_provider: string | null
  processing_started_at: string | null
  result_generated_email_id: string | null
  created_at: string
}

export type SalesFollowupQueueInsert = {
  generated_email_id: string
  contact_id: string
  campaign_id: string
  followup_number: number
  scheduled_at: string
  status?: SalesFollowupQueueStatus
}

export type SalesFollowupQueueListOptions = {
  campaignId?: string
  contactId?: string
  status?: SalesFollowupQueueStatus
  limit?: number
}
