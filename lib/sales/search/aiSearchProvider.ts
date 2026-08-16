import { buildAiSearchQueries } from '@/lib/sales/search/aiSearchQueryBuilder'
import { validateBusinessSearchInput } from '@/lib/sales/search/aiSearchInput'
import { prepareAiSearchProviderRequest } from '@/lib/sales/search/aiSearchRequest'
import { normalizeAiSearchProviderResponse } from '@/lib/sales/search/aiSearchResponseNormalizer'
import { executeAiSearchProviderRequest } from '@/lib/sales/search/aiSearchProviderClient'
import type { BusinessSearchProvider } from '@/lib/sales/search/businessSearchProvider.interface'
import type { BusinessSearchInput, BusinessSearchResult } from '@/lib/sales/search/businessSearch.types'

function isAiBusinessSearchEnabled(): boolean {
  const flag = process.env.SALES_AI_BUSINESS_SEARCH_ENABLED?.trim().toLowerCase()
  return flag === '1' || flag === 'true'
}

/**
 * AI-assisted web search orchestration (query build → request → client → normalize).
 * Web search client is not wired yet; enable flag gates the client call.
 */
export const aiSearchProvider: BusinessSearchProvider = {
  providerId: 'ai_search',

  async searchBusinesses(raw: BusinessSearchInput): Promise<BusinessSearchResult[]> {
    const input = validateBusinessSearchInput(raw)
    const queries = buildAiSearchQueries(input)
    const request = prepareAiSearchProviderRequest(input, queries)

    if (!isAiBusinessSearchEnabled()) {
      throw new Error(
        'AI business search is not enabled. Set SALES_AI_BUSINESS_SEARCH_ENABLED=true when the search client is wired.',
      )
    }

    const clientResponse = await executeAiSearchProviderRequest(request)
    return normalizeAiSearchProviderResponse(clientResponse, input)
  },
}

export { buildAiSearchQueries } from '@/lib/sales/search/aiSearchQueryBuilder'
export { validateBusinessSearchInput } from '@/lib/sales/search/aiSearchInput'
export { prepareAiSearchProviderRequest } from '@/lib/sales/search/aiSearchRequest'
export { normalizeAiSearchProviderResponse } from '@/lib/sales/search/aiSearchResponseNormalizer'
