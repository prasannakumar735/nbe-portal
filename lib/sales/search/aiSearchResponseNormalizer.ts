import type {
  AiSearchProviderClientResponse,
  AiSearchRawBusinessHit,
} from '@/lib/sales/search/aiSearch.types'
import type {
  BusinessSearchInput,
  BusinessSearchResult,
} from '@/lib/sales/search/businessSearch.types'

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function readRequiredString(value: unknown, field: string, index: number): string {
  const text = readOptionalString(value)
  if (!text) {
    throw new Error(`AI search hit at index ${index} is missing ${field}.`)
  }
  return text
}

function readConfidenceScore(hit: AiSearchRawBusinessHit): number {
  const raw =
    typeof hit.confidenceScore === 'number'
      ? hit.confidenceScore
      : typeof hit.confidence === 'number'
        ? hit.confidence
        : null
  if (raw == null || !Number.isFinite(raw)) return 0.5
  if (raw > 1 && raw <= 100) return Math.min(1, raw / 100)
  return Math.min(1, Math.max(0, raw))
}

function resolveCompanyName(hit: AiSearchRawBusinessHit, index: number): string {
  const name = readOptionalString(hit.companyName) ?? readOptionalString(hit.name)
  if (!name) {
    throw new Error(`AI search hit at index ${index} is missing companyName.`)
  }
  return name
}

function dedupeKey(result: BusinessSearchResult): string {
  return `${result.companyName.toLowerCase()}|${result.postcode}|${result.address.toLowerCase()}`
}

export function normalizeAiSearchProviderResponse(
  response: AiSearchProviderClientResponse,
  input: BusinessSearchInput,
): BusinessSearchResult[] {
  const seen = new Set<string>()
  const normalized: BusinessSearchResult[] = []

  for (let i = 0; i < response.hits.length; i++) {
    const hit = response.hits[i]
    const companyName = resolveCompanyName(hit, i)
    const address = readRequiredString(hit.address, 'address', i)
    const suburb = readOptionalString(hit.suburb) ?? input.suburb ?? ''
    const postcode = readOptionalString(hit.postcode) ?? input.postcode

    const result: BusinessSearchResult = {
      companyName,
      website: readOptionalString(hit.website),
      phone: readOptionalString(hit.phone),
      address,
      suburb,
      postcode,
      source: 'ai_search',
      confidenceScore: readConfidenceScore(hit),
    }

    const key = dedupeKey(result)
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(result)

    if (normalized.length >= input.limit) break
  }

  return normalized
}
