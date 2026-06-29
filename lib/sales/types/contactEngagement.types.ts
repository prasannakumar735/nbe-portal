export type SalesContactEngagement = {
  id: string
  contact_id: string
  campaign_id: string
  last_email_sent_at: string | null
  last_reply_at: string | null
  reply_detected: boolean
  opened: boolean
  clicked: boolean
  unsubscribed: boolean
  bounce_detected: boolean
  followup_count: number
  created_at: string
}

export type SalesContactEngagementInsert = {
  contact_id: string
  campaign_id: string
  last_email_sent_at?: string | null
}

export type SalesContactEngagementKey = {
  contact_id: string
  campaign_id: string
}
