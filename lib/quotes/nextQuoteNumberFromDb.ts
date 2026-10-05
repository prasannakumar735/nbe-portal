import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildQuoteNumber,
  isQuoteNumberPrefix,
  maxSequenceForPrefixDate,
  shortDateKey,
  type QuoteNumberPrefix,
} from '@/lib/quotes/quoteNumberPolicy'

/**
 * Next quote number for this prefix + calendar day, based on existing `quotes.quote_number` values.
 * Matches both the current format (e.g. QPTS261001%) and the legacy `PREFIX-YYYYMMDD-%` format,
 * so sequence numbers keep counting correctly across the format change.
 */
export async function nextQuoteNumberFromDb(
  supabase: SupabaseClient,
  prefix: QuoteNumberPrefix,
  dateKey: string,
): Promise<string> {
  const newPattern    = `${prefix}${shortDateKey(dateKey)}%`
  const legacyPattern = `${prefix}-${dateKey}-%`

  const [newRes, legacyRes] = await Promise.all([
    supabase.from('quotes').select('quote_number').like('quote_number', newPattern).limit(2000),
    supabase.from('quotes').select('quote_number').like('quote_number', legacyPattern).limit(2000),
  ])

  if (newRes.error) throw newRes.error
  if (legacyRes.error) throw legacyRes.error

  const numbers = [...(newRes.data ?? []), ...(legacyRes.data ?? [])].map(r =>
    String((r as { quote_number?: string }).quote_number ?? ''),
  )
  const nextSeq = maxSequenceForPrefixDate(numbers, prefix, dateKey) + 1
  return buildQuoteNumber(prefix, dateKey, nextSeq)
}

export function parseQuoteNumberRequestPrefix(raw: string | null): QuoteNumberPrefix | null {
  const p = String(raw ?? '').trim().toUpperCase()
  return isQuoteNumberPrefix(p) ? p : null
}
