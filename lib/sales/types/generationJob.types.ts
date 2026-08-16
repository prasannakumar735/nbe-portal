import type { SalesGenerationJobStatus } from '@/lib/sales/constants/generationJobStatuses'

export type { SalesGenerationJobStatus } from '@/lib/sales/constants/generationJobStatuses'

export { SALES_GENERATION_JOB_STATUSES } from '@/lib/sales/constants/generationJobStatuses'

export type SalesGenerationJob = {
  id: string
  campaign_id: string
  provider: string
  total_contacts: number
  processed_count: number
  success_count: number
  failed_count: number
  status: SalesGenerationJobStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export type SalesGenerationJobInsert = {
  campaign_id: string
  provider: string
  total_contacts: number
  status?: SalesGenerationJobStatus
}

export type SalesGenerationJobUpdate = {
  processed_count?: number
  success_count?: number
  failed_count?: number
  status?: SalesGenerationJobStatus
  started_at?: string | null
  completed_at?: string | null
}

export type SalesGenerationJobListOptions = {
  campaignId?: string
  status?: SalesGenerationJobStatus
  limit?: number
}
