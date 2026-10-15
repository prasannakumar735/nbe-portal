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
  // Current format: PREFIX-YYMMDDNNN (e.g. QREP-261015001)
  // Old compact format: PREFIXYYMMDDNNN (e.g. QREP261015001, no hyphen)
  // Legacy format: PREFIX-YYYYMMDD-NNN
  const hyphenPattern  = `${prefix}-${shortDateKey(dateKey)}%`
  const compactPattern = `${prefix}${shortDateKey(dateKey)}%`
  const legacyPattern  = `${prefix}-${dateKey}-%`

  const [hyphenRes, compactRes, legacyRes] = await Promise.all([
    supabase.from('quotes').select('quote_number').like('quote_number', hyphenPattern).limit(2000),
    supabase.from('quotes').select('quote_number').like('quote_number', compactPattern).limit(2000),
    supabase.from('quotes').select('quote_number').like('quote_number', legacyPattern).limit(2000),
  ])

  if (hyphenRes.error) throw hyphenRes.error
  if (compactRes.error) throw compactRes.error
  if (legacyRes.error) throw legacyRes.error

  const numbers = [...(hyphenRes.data ?? []), ...(compactRes.data ?? []), ...(legacyRes.data ?? [])].map(r =>
    String((r as { quote_number?: string }).quote_number ?? ''),
  )
  const nextSeq = maxSequenceForPrefixDate(numbers, prefix, dateKey) + 1
  return buildQuoteNumber(prefix, dateKey, nextSeq)
}

export function parseQuoteNumberRequestPrefix(raw: string | null): QuoteNumberPrefix | null {
  const p = String(raw ?? '').trim().toUpperCase()
  return isQuoteNumberPrefix(p) ? p : null
}
