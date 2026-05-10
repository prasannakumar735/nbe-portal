/**
 * Portal quote taxonomy (manager feedback — unified Quote structure).
 * Stored as slug strings on `quotes.quote_type` / `quotes.quote_sub_category`.
 */

export const QUOTE_TYPE_SLUGS = ['service', 'repair', 'parts_replacement', 'new_installation'] as const
export type QuoteTypeSlug = (typeof QUOTE_TYPE_SLUGS)[number]

export type QuoteSubCategoryOption = { value: string; label: string }

export const QUOTE_TYPE_LABELS: Record<QuoteTypeSlug, string> = {
  service: 'Service',
  repair: 'Repair',
  parts_replacement: 'Parts Replacement',
  new_installation: 'New Installation',
}

export const QUOTE_SUB_CATEGORIES: Record<QuoteTypeSlug, QuoteSubCategoryOption[]> = {
  service: [
    { value: '6_month_service', label: '6 Month Service' },
    { value: 'annual_service', label: 'Annual Service' },
  ],
  repair: [{ value: 'general_door_repair', label: 'General Door Repair' }],
  parts_replacement: [
    { value: 'curtain', label: 'Curtain' },
    { value: 'uprights', label: 'Uprights' },
    { value: 'top_section', label: 'Top Section' },
    { value: 'drive_system', label: 'Drive System' },
    { value: 'motor', label: 'Motor' },
    { value: 'photo_cell', label: 'Photo Cell' },
    { value: 'safety_edge', label: 'Safety Edge' },
    { value: 'other_parts', label: 'Other Parts' },
  ],
  new_installation: [
    { value: 'rapid_door', label: 'Rapid Door' },
    { value: 'pvc_curtain', label: 'PVC Curtain' },
    { value: 'pvc_swing_door', label: 'PVC Swing Door' },
    { value: 'control_box', label: 'Control Box' },
  ],
}

export function isQuoteTypeSlug(v: string | null | undefined): v is QuoteTypeSlug {
  return QUOTE_TYPE_SLUGS.includes(v as QuoteTypeSlug)
}

export function subCategoryAllowed(type: QuoteTypeSlug, subSlug: string): boolean {
  return QUOTE_SUB_CATEGORIES[type].some(o => o.value === subSlug)
}

export function defaultSubCategoryForType(type: QuoteTypeSlug): string {
  return QUOTE_SUB_CATEGORIES[type][0]?.value ?? ''
}

/** Labels for PDF / read-only UI */
export function formatQuoteTaxonomyLine(typeSlug: string | undefined, subSlug: string | undefined): string {
  if (!typeSlug || !isQuoteTypeSlug(typeSlug)) return '—'
  const typeLabel = QUOTE_TYPE_LABELS[typeSlug]
  const subOpts = QUOTE_SUB_CATEGORIES[typeSlug]
  const sub = subOpts.find(o => o.value === subSlug)
  const subLabel = sub?.label ?? subSlug ?? '—'
  return `${typeLabel} · ${subLabel}`
}

/**
 * Persist taxonomy from API payloads.
 * Industrial Rapid Door quotes always classify as New Installation → Rapid Door.
 */
export function resolveQuoteTaxonomyForPersist(opts: {
  quote_kind?: string | null
  quote_type?: string | null
  quote_sub_category?: string | null
}): { quote_type: string; quote_sub_category: string } {
  if (opts.quote_kind === 'rapid_door') {
    return { quote_type: 'new_installation', quote_sub_category: 'rapid_door' }
  }

  const typeRaw = opts.quote_type?.trim().toLowerCase() ?? ''
  const subRaw = opts.quote_sub_category?.trim().toLowerCase() ?? ''

  if (!isQuoteTypeSlug(typeRaw)) {
    throw new Error('Choose a valid quote type.')
  }
  if (!subRaw || !subCategoryAllowed(typeRaw, subRaw)) {
    throw new Error('Choose a valid sub-category for the selected quote type.')
  }

  return { quote_type: typeRaw, quote_sub_category: subRaw }
}
