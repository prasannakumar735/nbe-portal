import type { QuoteTypeSlug } from '@/lib/quotes/quoteTaxonomy'

/** Prefixes used in portal-generated quote numbers (per manager / product line). */
export const QUOTE_NUMBER_PREFIXES = ['RRD', 'SWD', 'IRD', 'QRRD', 'QREP', 'QGEN', 'QPTS', 'QPVC'] as const
export type QuoteNumberPrefix = (typeof QUOTE_NUMBER_PREFIXES)[number]

export function isQuoteNumberPrefix(v: string): v is QuoteNumberPrefix {
  return (QUOTE_NUMBER_PREFIXES as readonly string[]).includes(v)
}

/** Calendar YYYYMMDD in Australia/Melbourne time (handles AEST/AEDT automatically). */
export function localDateKeyYmd(_d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).replace(/-/g, '')
}

/**
 * Service / unified flow: PVC Swing Door uses SWD; all other taxonomy rows use RRD.
 */
export function quoteNumberPrefixForServiceTaxonomy(
  quoteType: QuoteTypeSlug,
  quoteSubCategory: string,
): 'RRD' | 'SWD' {
  const sub = String(quoteSubCategory ?? '').trim()
  if (quoteType === 'new_installation' && sub === 'pvc_swing_door') return 'SWD'
  return 'RRD'
}

function padSequence(prefix: QuoteNumberPrefix, n: number): string {
  if (prefix === 'SWD') return String(Math.max(1, n)).padStart(2, '0')
  return String(Math.max(1, n)).padStart(3, '0')
}

/** Drops the century from a YYYYMMDD date key, e.g. "20261001" -> "261001". */
export function shortDateKey(dateKey: string): string {
  return dateKey.length === 8 ? dateKey.slice(2) : dateKey
}

/**
 * New format (no separators, 2-digit year): e.g. QPTS261001001.
 * `dateKey` is still the full YYYYMMDD; the century is dropped here only.
 */
export function buildQuoteNumber(prefix: QuoteNumberPrefix, dateKey: string, sequence: number): string {
  return `${prefix}${shortDateKey(dateKey)}${padSequence(prefix, sequence)}`
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Max numeric suffix for quote numbers with this prefix + date. Matches both the
 * current no-dash/short-year format (e.g. QPTS261001001) and the legacy
 * `PREFIX-YYYYMMDD-###` format, so existing quotes keep counting correctly.
 */
export function maxSequenceForPrefixDate(quoteNumbers: string[], prefix: QuoteNumberPrefix, dateKey: string): number {
  const seqDigits = prefix === 'SWD' ? '{2}' : '{3}'
  const reNew    = new RegExp(`^${escapeRegExp(prefix)}${escapeRegExp(shortDateKey(dateKey))}(\\d${seqDigits})$`)
  const reLegacy = new RegExp(`^${escapeRegExp(prefix)}-${escapeRegExp(dateKey)}-(\\d+)$`)
  let max = 0
  for (const q of quoteNumbers) {
    const trimmed = String(q ?? '').trim()
    const m = trimmed.match(reNew) ?? trimmed.match(reLegacy)
    if (!m) continue
    const n = parseInt(m[1], 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}
