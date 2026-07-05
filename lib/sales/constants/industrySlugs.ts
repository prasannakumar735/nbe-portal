export const SALES_INDUSTRY_SLUGS = [
  'general',
  'food_processing',
  'cold_storage',
  'warehousing',
  'manufacturing',
  'logistics',
  'pharmaceutical',
] as const

export type SalesIndustrySlug = (typeof SALES_INDUSTRY_SLUGS)[number]

export function isSalesIndustrySlug(value: string): value is SalesIndustrySlug {
  return (SALES_INDUSTRY_SLUGS as readonly string[]).includes(value)
}

export const SALES_INDUSTRY_LABELS: Record<SalesIndustrySlug, string> = {
  general: 'General',
  food_processing: 'Food Processing',
  cold_storage: 'Cold Storage',
  warehousing: 'Warehousing',
  manufacturing: 'Manufacturing',
  logistics: 'Logistics',
  pharmaceutical: 'Pharmaceutical',
}
