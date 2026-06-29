import type { SalesGeneratedEmailStatus } from '@/lib/sales/constants/generatedEmailStatuses'

export type { SalesGeneratedEmailStatus } from '@/lib/sales/constants/generatedEmailStatuses'

export { SALES_GENERATED_EMAIL_STATUSES } from '@/lib/sales/constants/generatedEmailStatuses'

export type SalesGeneratedEmail = {
  id: string
  campaign_id: string
  contact_id: string
  subject: string
  body: string
  generation_provider: string
  status: SalesGeneratedEmailStatus
  version: number
  parent_generated_email_id: string | null
  thread_root_email_id: string | null
  sequence_position: number
  reviewed_by: string | null
  reviewed_at: string | null
  updated_at: string | null
  created_at: string
}

export type SalesGeneratedEmailReviewPatch = {
  subject: string
  body: string
}

export type SalesGeneratedEmailInsert = {
  campaign_id: string
  contact_id: string
  subject: string
  body: string
  generation_provider: string
  status?: SalesGeneratedEmailStatus
  version?: number
  parent_generated_email_id?: string | null
  thread_root_email_id?: string | null
  sequence_position?: number
}

export type SalesGeneratedEmailUpdate = {
  subject?: string
  body?: string
  status?: SalesGeneratedEmailStatus
}
