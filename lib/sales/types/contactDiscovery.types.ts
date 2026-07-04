export const CONTACT_PAGE_KINDS = [
  'homepage',
  'contact',
  'quote',
  'sales',
  'locations_hub',
  'branch',
  'service',
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
