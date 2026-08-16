import type { SalesEmailMessageDirection, SalesEmailMessageImportSource } from '@/lib/sales/constants/emailMessageDirections'
import type { SalesEmailThreadStatus } from '@/lib/sales/constants/emailThreadStatuses'
import type { SalesManagerNotificationPriority, SalesManagerNotificationType } from '@/lib/sales/constants/managerNotifications'
import type { SalesReplyAnalysisCategory, SalesReplyAnalysisStatus } from '@/lib/sales/constants/replyAnalysis'
import type { SalesReplyDraftStatus } from '@/lib/sales/constants/replyDraftStatuses'

export type SalesEmailThread = {
  id: string
  campaign_id: string
  contact_id: string
  business_id: string | null
  opportunity_id: string | null
  graph_conversation_id: string | null
  graph_thread_id: string | null
  status: SalesEmailThreadStatus
  created_at: string
  updated_at: string
}

export type SalesEmailThreadInsert = {
  campaign_id: string
  contact_id: string
  business_id?: string | null
  opportunity_id?: string | null
  graph_conversation_id?: string | null
  graph_thread_id?: string | null
  status?: SalesEmailThreadStatus
}

export type SalesEmailThreadPatch = {
  status?: SalesEmailThreadStatus
  business_id?: string | null
  opportunity_id?: string | null
  graph_conversation_id?: string | null
  graph_thread_id?: string | null
}

export type SalesEmailMessage = {
  id: string
  thread_id: string
  direction: SalesEmailMessageDirection
  generated_email_id: string | null
  delivery_log_id: string | null
  graph_message_id: string | null
  internet_message_id: string | null
  conversation_id: string | null
  in_reply_to: string | null
  sender: string | null
  recipients: string[]
  subject: string
  body_html: string | null
  body_text: string | null
  received_at: string | null
  import_source: SalesEmailMessageImportSource
  created_at: string
}

export type SalesEmailMessageInsert = {
  thread_id: string
  direction: SalesEmailMessageDirection
  generated_email_id?: string | null
  delivery_log_id?: string | null
  graph_message_id?: string | null
  internet_message_id?: string | null
  conversation_id?: string | null
  in_reply_to?: string | null
  sender?: string | null
  recipients?: string[]
  subject: string
  body_html?: string | null
  body_text?: string | null
  received_at?: string | null
  import_source?: SalesEmailMessageImportSource
}

/** Versioned analysis rows — insert new version; do not update in place. */
export type SalesReplyAnalysis = {
  id: string
  message_id: string
  analysis_version: number
  model_name: string | null
  prompt_version: number | null
  summary: string | null
  sentiment: string | null
  buying_intent: string | null
  categories: SalesReplyAnalysisCategory[]
  urgency: string | null
  suggested_next_action: string | null
  confidence: number | null
  analysis_status: SalesReplyAnalysisStatus
  products_mentioned: string[] | null
  competitors_mentioned: string[] | null
  requested_installation_location: string | null
  requested_delivery_timeframe: string | null
  budget_reference: string | null
  created_at: string
}

export type SalesReplyAnalysisInsert = {
  message_id: string
  analysis_version: number
  model_name?: string | null
  prompt_version?: number | null
  summary?: string | null
  sentiment?: string | null
  buying_intent?: string | null
  categories?: SalesReplyAnalysisCategory[]
  urgency?: string | null
  suggested_next_action?: string | null
  confidence?: number | null
  analysis_status?: SalesReplyAnalysisStatus
}

export type SalesReplyDraft = {
  id: string
  thread_id: string
  in_reply_to_message_id: string | null
  subject: string
  body: string
  status: SalesReplyDraftStatus
  prompt_library_id: string | null
  prompt_name: string | null
  prompt_version: number | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type SalesReplyDraftInsert = {
  thread_id: string
  in_reply_to_message_id?: string | null
  subject: string
  body: string
  status?: SalesReplyDraftStatus
  prompt_library_id?: string | null
  prompt_name?: string | null
  prompt_version?: number | null
}

export type SalesReplyDraftPatch = {
  subject?: string
  body?: string
  status?: SalesReplyDraftStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
}

export type SalesMailboxSyncState = {
  id: string
  mailbox_user_id: string
  folder: string
  delta_link: string | null
  last_received_at: string | null
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type SalesMailboxSyncStateUpsert = {
  mailbox_user_id: string
  folder?: string
  delta_link?: string | null
  last_received_at?: string | null
  last_sync_at?: string | null
  last_error?: string | null
}

export type SalesManagerNotification = {
  id: string
  notification_type: SalesManagerNotificationType
  priority: SalesManagerNotificationPriority
  thread_id: string | null
  message_id: string | null
  read_at: string | null
  created_at: string
}

export type SalesManagerNotificationInsert = {
  notification_type: SalesManagerNotificationType
  priority: SalesManagerNotificationPriority
  thread_id?: string | null
  message_id?: string | null
}

export type SalesEmailThreadListOptions = {
  campaignId?: string
  contactId?: string
  status?: SalesEmailThreadStatus
  limit?: number
}
