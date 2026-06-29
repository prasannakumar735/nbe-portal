/** Business lifecycle — not UI checkbox selection (see `selected` on row). */
export const SALES_BUSINESS_STATUSES = [
  'new',
  'reviewed',
  'contacted',
  'replied',
  'unsubscribed',
  'ignored',
] as const

export type SalesBusinessStatus = (typeof SALES_BUSINESS_STATUSES)[number]
