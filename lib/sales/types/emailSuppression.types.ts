import type { SalesEmailSuppressionReason } from '@/lib/sales/constants/suppressionReasons'

export type { SalesEmailSuppressionReason } from '@/lib/sales/constants/suppressionReasons'

export type SalesEmailSuppression = {
  id: string
  email_address: string
  reason: SalesEmailSuppressionReason
  contact_id: string | null
  campaign_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export type SalesEmailSuppressionInsert = {
  email_address: string
  reason: SalesEmailSuppressionReason
  contact_id?: string | null
  campaign_id?: string | null
  notes?: string | null
  created_by?: string | null
}
