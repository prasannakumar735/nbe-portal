'use client'

/**
 * Allocates the next sequential quote number for the given prefix and local calendar day.
 */
export async function fetchNextQuoteNumberClient(
  prefix: 'RRD' | 'SWD' | 'IRD',
  dateKey: string,
): Promise<string> {
  const u = new URL('/api/quotes/next-number', typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  u.searchParams.set('prefix', prefix)
  u.searchParams.set('dateKey', dateKey)
  const r = await fetch(u.toString())
  const data = (await r.json()) as { quoteNumber?: string; error?: string }
  if (!r.ok) {
    throw new Error(data.error || 'Failed to allocate quote number.')
  }
  if (!data.quoteNumber?.trim()) {
    throw new Error('Invalid response from quote number service.')
  }
  return data.quoteNumber.trim()
}
