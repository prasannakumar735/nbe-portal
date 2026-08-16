import { aiSearchProvider } from '@/lib/sales/search/aiSearchProvider'
import type { BusinessSearchProvider } from '@/lib/sales/search/businessSearchProvider.interface'
import {
  isBusinessSearchProviderId,
  type BusinessSearchInput,
  type BusinessSearchProviderId,
  type BusinessSearchResult,
} from '@/lib/sales/search/businessSearch.types'

const googlePlacesSearchProvider: BusinessSearchProvider = {
  providerId: 'google_places',
  async searchBusinesses(_input: BusinessSearchInput): Promise<BusinessSearchResult[]> {
    throw new Error('google_places business search provider is not configured.')
  },
}

const yellowPagesSearchProvider: BusinessSearchProvider = {
  providerId: 'yellow_pages',
  async searchBusinesses(_input: BusinessSearchInput): Promise<BusinessSearchResult[]> {
    throw new Error('yellow_pages business search provider is not configured.')
  },
}

const providers: Record<BusinessSearchProviderId, BusinessSearchProvider> = {
  ai_search: aiSearchProvider,
  google_places: googlePlacesSearchProvider,
  yellow_pages: yellowPagesSearchProvider,
}

export function getBusinessSearchProvider(providerId: string): BusinessSearchProvider {
  if (!isBusinessSearchProviderId(providerId)) {
    throw new Error(`Unknown business search provider: ${providerId}`)
  }
  return providers[providerId]
}

export function listRegisteredBusinessSearchProviderIds(): BusinessSearchProviderId[] {
  return Object.keys(providers) as BusinessSearchProviderId[]
}

/**
 * Resolve provider from `SALES_BUSINESS_SEARCH_PROVIDER` (defaults to `ai_search`).
 */
export function resolveBusinessSearchProvider(): BusinessSearchProvider {
  const fromEnv = process.env.SALES_BUSINESS_SEARCH_PROVIDER?.trim().toLowerCase()
  if (fromEnv && isBusinessSearchProviderId(fromEnv)) {
    return getBusinessSearchProvider(fromEnv)
  }
  return aiSearchProvider
}

/**
 * Provider-agnostic entry for the Business Discovery Engine (read-only; no DB writes).
 */
export async function searchBusinesses(
  input: BusinessSearchInput,
  providerId?: BusinessSearchProviderId,
): Promise<BusinessSearchResult[]> {
  const provider = providerId ? getBusinessSearchProvider(providerId) : resolveBusinessSearchProvider()
  return provider.searchBusinesses(input)
}

export type { BusinessSearchProvider } from '@/lib/sales/search/businessSearchProvider.interface'
