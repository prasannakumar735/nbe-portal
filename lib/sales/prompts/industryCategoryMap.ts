import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import { isSalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'

/**
 * Maps Google Places / discovery category text to Prompt Library industry slug.
 */
const CATEGORY_INDUSTRY_KEYWORDS: { slug: SalesIndustrySlug; keywords: string[] }[] = [
  { slug: 'cold_storage', keywords: ['cold storage', 'cold store', 'freezer', 'refrigerat'] },
  { slug: 'food_processing', keywords: ['food processing', 'food manufacture', 'abattoir', 'bakery', 'brewery'] },
  { slug: 'pharmaceutical', keywords: ['pharmaceutical', 'pharma', 'medical device', 'laboratory'] },
  { slug: 'logistics', keywords: ['logistics', 'courier', 'freight', 'transport', 'distribution centre'] },
  { slug: 'manufacturing', keywords: ['manufactur', 'factory', 'production', 'industrial'] },
  { slug: 'warehousing', keywords: ['warehouse', 'storage', 'fulfilment', 'fulfillment', '3pl'] },
]

export function inferIndustrySlugFromBusinessCategory(category: string | null | undefined): SalesIndustrySlug {
  const lower = (category ?? '').trim().toLowerCase()
  if (!lower) return 'general'
  for (const entry of CATEGORY_INDUSTRY_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.slug
    }
  }
  return 'general'
}

/** Bridge campaign type display name → product line until campaigns store product_slug directly. */
export function inferProductSlugFromCampaignTypeName(name: string): SalesProductLineSlug | null {
  const lower = name.trim().toLowerCase()
  if (lower.includes('pvc') || lower.includes('strip curtain')) return 'pvc_strip_curtains'
  if (lower.includes('roller') || lower.includes('rapid door')) return 'rapid_roller_doors'
  if (lower.includes('preventive') || lower.includes('maintenance')) return 'preventive_maintenance'
  if (lower.includes('dock')) return 'dock_doors'
  return null
}

export function normalizeIndustrySlug(value: string | null | undefined): SalesIndustrySlug {
  const trimmed = (value ?? '').trim().toLowerCase().replace(/\s+/g, '_')
  if (isSalesIndustrySlug(trimmed)) return trimmed
  return inferIndustrySlugFromBusinessCategory(value)
}
