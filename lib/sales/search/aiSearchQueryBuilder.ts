import type { BusinessSearchInput } from '@/lib/sales/search/businessSearch.types'

/**
 * Build web search query variants for AI business discovery.
 * Examples: "{category} {postcode}", "{category} near {postcode}", "{category} {suburb}".
 */
export function buildAiSearchQueries(input: BusinessSearchInput): string[] {
  const { category, postcode, suburb } = input
  const queries: string[] = [`${category} ${postcode}`, `${category} near ${postcode}`]

  if (suburb) {
    queries.push(`${category} ${suburb}`)
  }

  return queries
}
