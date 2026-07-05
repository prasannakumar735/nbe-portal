export const SALES_REPLY_DRAFT_STATUSES = [
  'draft',
  'edited',
  'approved',
  'rejected',
] as const

export type SalesReplyDraftStatus = (typeof SALES_REPLY_DRAFT_STATUSES)[number]
