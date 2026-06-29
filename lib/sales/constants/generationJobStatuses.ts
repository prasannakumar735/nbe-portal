/** Batch email generation job lifecycle (Phase 5). */

export const SALES_GENERATION_JOB_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const

export type SalesGenerationJobStatus = (typeof SALES_GENERATION_JOB_STATUSES)[number]
