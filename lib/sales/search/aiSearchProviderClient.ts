import type {
  AiSearchProviderClientResponse,
  AiSearchProviderRequest,
} from '@/lib/sales/search/aiSearch.types'

export class AiSearchProviderClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiSearchProviderClientError'
  }
}

/**
 * Execute AI web search for the prepared request.
 *
 * TODO: Wire xAI/Grok Responses API with web search tools (or equivalent provider client).
 * TODO: Map tool output into `AiSearchRawBusinessHit[]` and return `{ hits }`.
 */
export async function executeAiSearchProviderRequest(
  _request: AiSearchProviderRequest,
): Promise<AiSearchProviderClientResponse> {
  throw new AiSearchProviderClientError('AI search provider client is not implemented yet.')
}
