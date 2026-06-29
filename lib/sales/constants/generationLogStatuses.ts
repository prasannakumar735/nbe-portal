/** LLM generation attempt outcome (Phase 4.7 observability). */

export const SALES_GENERATION_LOG_STATUSES = [
  'success',
  'failed',
  'timeout',
  'rate_limited',
  'provider_error',
] as const

export type SalesGenerationLogStatus = (typeof SALES_GENERATION_LOG_STATUSES)[number]
