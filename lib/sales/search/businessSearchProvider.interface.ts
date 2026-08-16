import type {
  BusinessSearchInput,
  BusinessSearchProviderId,
  BusinessSearchResult,
} from '@/lib/sales/search/businessSearch.types'

export interface BusinessSearchProvider {
  readonly providerId: BusinessSearchProviderId
  searchBusinesses(input: BusinessSearchInput): Promise<BusinessSearchResult[]>
}
