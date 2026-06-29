export const SALES_BUSINESS_SOURCES = [
  'manual',
  'google_maps',
  'yellow_pages',
  'linkedin',
  'website_scan',
] as const

export type SalesBusinessSource = (typeof SALES_BUSINESS_SOURCES)[number]
