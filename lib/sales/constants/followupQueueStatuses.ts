export const SALES_FOLLOWUP_QUEUE_STATUSES = [
  'scheduled',
  'generating',
  'queued',
  'sent',
  'skipped',
  'cancelled',
] as const

export type SalesFollowupQueueStatus = (typeof SALES_FOLLOWUP_QUEUE_STATUSES)[number]

export function isSalesFollowupQueueStatus(value: string): value is SalesFollowupQueueStatus {
  return (SALES_FOLLOWUP_QUEUE_STATUSES as readonly string[]).includes(value)
}
