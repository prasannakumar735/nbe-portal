export const SALES_CONTACT_TYPES = [
  'general',
  'sales',
  'support',
  'manager',
  'operations',
  'maintenance',
  'unknown',
] as const

export type SalesContactType = (typeof SALES_CONTACT_TYPES)[number]

export const SALES_CONTACT_SOURCES = [
  'website_scan',
  'manual',
  'linkedin',
  'directory',
] as const

export type SalesContactSource = (typeof SALES_CONTACT_SOURCES)[number]
