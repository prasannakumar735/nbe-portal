import type { SalesGenerationLogStatus } from '@/lib/sales/constants/generationLogStatuses'

export type { SalesGenerationLogStatus } from '@/lib/sales/constants/generationLogStatuses'

export { SALES_GENERATION_LOG_STATUSES } from '@/lib/sales/constants/generationLogStatuses'

export type SalesGenerationLog = {
  id: string
  generated_email_id: string | null
  campaign_id: string
  contact_id: string
  provider: string
  prompt_tokens: number
  completion_tokens: number
  estimated_cost: number
  latency_ms: number
  status: SalesGenerationLogStatus
  failure_reason: string | null
  created_at: string
}

export type SalesGenerationLogInsert = {
  generated_email_id?: string | null
  campaign_id: string
  contact_id: string
  provider: string
  prompt_tokens?: number
  completion_tokens?: number
  estimated_cost?: number
  latency_ms?: number
  status?: SalesGenerationLogStatus
  failure_reason?: string | null
}

export type SalesGenerationLogListOptions = {
  campaignId?: string
  contactId?: string
  provider?: string
  status?: SalesGenerationLogStatus
  limit?: number
}
