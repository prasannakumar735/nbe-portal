import type { SalesCoreAgentId } from '@/lib/sales/agents/agent.types'
import type { SalesJobType } from '@/lib/sales/jobs/job.types'

export const SALES_AGENT_QUEUE_KINDS = [
  'sales_jobs',
  'email_send_queue',
  'followup_queue',
  'inline',
] as const

export type SalesAgentQueueKind = (typeof SALES_AGENT_QUEUE_KINDS)[number]

export const SALES_AGENT_RUN_STATUSES = ['running', 'completed', 'failed'] as const

export type SalesAgentRunStatus = (typeof SALES_AGENT_RUN_STATUSES)[number]

export type SalesAgentDefinition = {
  id: SalesCoreAgentId
  label: string
  queueKind: SalesAgentQueueKind
  /** When backed by `sales_jobs`, the job_type value. */
  jobType?: SalesJobType
  retryable: boolean
  description: string
}

export type SalesAgentDispatchOptions = {
  limit?: number
  jobIds?: string[]
  queueIds?: string[]
  retryFailed?: boolean
  maxAttempts?: number
}

export type SalesAgentDispatchItemResult = {
  agentId: SalesCoreAgentId
  referenceId: string
  status: SalesAgentRunStatus
  output?: Record<string, unknown>
  errorMessage?: string | null
  durationMs: number
}

export type SalesAgentDispatchResult = {
  agentId: SalesCoreAgentId
  processed: number
  results: SalesAgentDispatchItemResult[]
}

export type SalesAgentStatusSnapshot = {
  agentId: SalesCoreAgentId
  queueKind: SalesAgentQueueKind
  pendingCount: number | null
}
