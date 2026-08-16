import type { SalesEngagementEventSource, SalesEngagementEventType } from '@/lib/sales/constants/engagementEventTypes'

export type SalesEngagementEvent = {
  id: string
  campaign_id: string
  contact_id: string
  generated_email_id: string | null
  queue_id: string | null
  prompt_library_id: string | null
  prompt_name: string | null
  prompt_version: number | null
  event_type: SalesEngagementEventType
  source: SalesEngagementEventSource
  occurred_at: string
  metadata: Record<string, unknown>
  idempotency_key: string | null
  created_at: string
}

export type SalesEngagementEventInsert = {
  campaign_id: string
  contact_id: string
  event_type: SalesEngagementEventType
  source: SalesEngagementEventSource
  generated_email_id?: string | null
  queue_id?: string | null
  prompt_library_id?: string | null
  prompt_name?: string | null
  prompt_version?: number | null
  occurred_at?: string
  metadata?: Record<string, unknown>
  idempotency_key?: string | null
}

export type CampaignEngagementFunnel = {
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  unsubscribed: number
  /** Unique contacts with each flag on sales_contact_engagement */
  contactsDelivered: number
  contactsOpened: number
  contactsClicked: number
  contactsReplied: number
  contactsBounced: number
  contactsUnsubscribed: number
}
