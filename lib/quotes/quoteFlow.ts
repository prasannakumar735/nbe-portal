import type { QuoteTypeSlug } from '@/lib/quotes/quoteTaxonomy'

/** Industrial Rapid Door workflow: taxonomy drives the specialized template (`quote_kind: rapid_door`). */
export function isIndustrialRapidDoorTaxonomy(
  quoteType: QuoteTypeSlug | string,
  quoteSubCategory: string,
): boolean {
  return String(quoteType).trim() === 'new_installation' && String(quoteSubCategory).trim() === 'rapid_door'
}
