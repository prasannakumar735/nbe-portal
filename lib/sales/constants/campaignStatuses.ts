/** Campaign workflow status (not product catalog). */
export const SALES_CAMPAIGN_STATUSES = [
  'draft',
  'ready',
  'sending',
  'completed',
  'paused',
] as const

export type SalesCampaignStatus = (typeof SALES_CAMPAIGN_STATUSES)[number]
