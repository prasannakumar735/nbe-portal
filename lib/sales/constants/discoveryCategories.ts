/** PVC strip curtain prospect categories for Business Discovery Agent. */
export const PVC_DISCOVERY_CATEGORIES = [
  'warehouse',
  'logistics company',
  'cold storage',
  'freezer warehouse',
  'food manufacturing',
  'manufacturing facility',
  'factory',
] as const

export type PvcDiscoveryCategory = (typeof PVC_DISCOVERY_CATEGORIES)[number]
