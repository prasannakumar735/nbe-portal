/** Business search provider keys (discovery layer; map to `SalesBusinessSource` at persist time). */

export const BUSINESS_SEARCH_PROVIDER_IDS = [
  'ai_search',
  'google_places',
  'yellow_pages',
] as const

export type BusinessSearchProviderId = (typeof BUSINESS_SEARCH_PROVIDER_IDS)[number]

export function isBusinessSearchProviderId(value: string): value is BusinessSearchProviderId {
  return (BUSINESS_SEARCH_PROVIDER_IDS as readonly string[]).includes(value)
}

/** Provenance on a single search hit (search layer; not identical to DB `source` enum). */
export type BusinessSearchResultSource = BusinessSearchProviderId

export type BusinessSearchInput = {
  postcode: string
  category: string
  state: string
  limit: number
  /** When set, enables the "{category} {suburb}" query variant. */
  suburb?: string
}

export type BusinessSearchResult = {
  companyName: string
  website: string | null
  phone: string | null
  address: string
  suburb: string
  postcode: string
  source: BusinessSearchResultSource
  confidenceScore: number
}

export const BUSINESS_SEARCH_DEFAULT_LIMIT = 25

export const BUSINESS_SEARCH_MAX_LIMIT = 50
