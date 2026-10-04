import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildQuoteNumber,
  isQuoteNumberPrefix,
  maxSequenceForPrefixDate,
  type QuoteNumberPrefix,
} from '@/lib/quotes/quoteNumberPolicy'

/**
 * Next quote number for this prefix + calendar day, based on existing `quotes.quote_number` values.
 */
export async function nextQuoteNumberFromDb(
  supabase: SupabaseClient,
  prefix: QuoteNumberPrefix,
  dateKey: string,
): Promise<string> {
  const pattern = `${prefix}-${dateKey}-%`
  const { data, error } = await supabase.from('quotes').select('quote_number').like('quote_number', pattern).limit(2000)

  if (error) throw error

  const numbers = (data ?? []).map(r => String((r as { quote_number?: string }).quote_number ?? ''))
  const nextSeq = maxSequenceForPrefixDate(numbers, prefix, dateKey) + 1
  return buildQuoteNumber(prefix, dateKey, nextSeq)
}

export function parseQuoteNumberRequestPrefix(raw: string | null): QuoteNumberPrefix | null {
  const p = String(raw ?? '').trim().toUpperCase()
  return isQuoteNumberPrefix(p) ? p : null
}
