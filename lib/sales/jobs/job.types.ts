export const SALES_JOB_TYPES = [
  'business_discovery',
  'contact_discovery',
  'email_generation',
  'email_sending',
  'followup',
  'unsubscribe',
] as const

export type SalesJobType = (typeof SALES_JOB_TYPES)[number]

export const SALES_JOB_STATUSES = ['pending', 'running', 'completed', 'failed'] as const

export type SalesJobStatus = (typeof SALES_JOB_STATUSES)[number]

export type SalesJob = {
  id: string
  job_type: SalesJobType
  payload: Record<string, unknown>
  status: SalesJobStatus
  attempts: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export type SalesJobInsert = {
  job_type: SalesJobType
  payload: Record<string, unknown>
  status?: SalesJobStatus
}

/** One postcode per job — enables parallel progress and retries. */
export type BusinessDiscoveryJobPayload = {
  postcode: string
  categories: string[]
  created_by: string
}

export type ContactDiscoveryJobPayload = {
  business_id: string
  created_by: string
}

export type EmailGenerationJobPayload = {
  campaign_id: string
  provider: string
  created_by: string
  /** Resume an in-flight batch instead of creating a duplicate sales_generation_jobs row. */
  generation_job_id?: string
}

export type EmailSendingJobPayload = {
  business_ids: string[]
  created_by: string
}

export type FollowupJobPayload = {
  business_ids: string[]
  created_by: string
}

export type UnsubscribeJobPayload = {
  email: string
  created_by: string
}

export type SalesJobPayloadByType = {
  business_discovery: BusinessDiscoveryJobPayload
  contact_discovery: ContactDiscoveryJobPayload
  email_generation: EmailGenerationJobPayload
  email_sending: EmailSendingJobPayload
  followup: FollowupJobPayload
  unsubscribe: UnsubscribeJobPayload
}

export type SalesJobProcessResult = {
  job_id: string
  job_type: SalesJobType
  status: SalesJobStatus
  result?: unknown
  error_message?: string | null
}

export type ProcessSalesJobsOptions = {
  jobIds?: string[]
  limit?: number
  /** Re-queue failed jobs when attempts below max. */
  retryFailed?: boolean
  maxAttempts?: number
}
