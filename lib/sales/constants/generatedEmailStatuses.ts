/** Generated email review / send lifecycle (Phase 4.6+). */

export const SALES_GENERATED_EMAIL_STATUSES = [
  'draft',
  'approved',
  'edited',
  'rejected',
  'queued',
  'sent',
] as const

export type SalesGeneratedEmailStatus = (typeof SALES_GENERATED_EMAIL_STATUSES)[number]
