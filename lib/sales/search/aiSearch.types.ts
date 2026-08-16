import type { BusinessSearchInput } from '@/lib/sales/search/businessSearch.types'

/** Outbound request passed to the AI search client (no HTTP yet). */
export type AiSearchProviderRequest = {
  providerId: 'ai_search'
  input: BusinessSearchInput
  queries: string[]
  limit: number
  locale: 'en-AU'
  region: {
    postcode: string
    state: string
    suburb?: string
  }
}

/** Loose shape from the future AI search client before normalization. */
export type AiSearchRawBusinessHit = {
  companyName?: unknown
  name?: unknown
  website?: unknown
  phone?: unknown
  address?: unknown
  suburb?: unknown
  postcode?: unknown
  confidenceScore?: unknown
  confidence?: unknown
}

export type AiSearchProviderClientResponse = {
  hits: AiSearchRawBusinessHit[]
}
