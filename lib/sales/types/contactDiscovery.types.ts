export const CONTACT_PAGE_KINDS = [
  'homepage',
  'contact',
  'branch',
  'location',
  'quote',
  'other',
] as const

export type ContactPageKind = (typeof CONTACT_PAGE_KINDS)[number]

export const CONTACT_DISCOVERY_METHODS = [
  'mailto',
  'mailto_labeled',
  'body_text',
  'tel',
] as const

export type ContactDiscoveryMethod = (typeof CONTACT_DISCOVERY_METHODS)[number]

/** Maps legacy persisted page_kind values to the canonical set. */
export function normalizeContactPageKind(raw: string | null | undefined): ContactPageKind | null {
  if (raw == null || raw === '') return null
  if ((CONTACT_PAGE_KINDS as readonly string[]).includes(raw)) {
    return raw as ContactPageKind
  }
  switch (raw) {
    case 'locations_hub':
      return 'location'
    case 'sales':
    case 'service':
      return 'other'
    default:
      return 'other'
  }
}
