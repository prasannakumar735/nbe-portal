import type { AiSearchProviderRequest } from '@/lib/sales/search/aiSearch.types'
import type { BusinessSearchInput } from '@/lib/sales/search/businessSearch.types'

export function prepareAiSearchProviderRequest(
  input: BusinessSearchInput,
  queries: string[],
): AiSearchProviderRequest {
  return {
    providerId: 'ai_search',
    input,
    queries,
    limit: input.limit,
    locale: 'en-AU',
    region: {
      postcode: input.postcode,
      state: input.state,
      suburb: input.suburb,
    },
  }
}
