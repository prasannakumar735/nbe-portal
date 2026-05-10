import type { QuoteTypeSlug } from '@/lib/quotes/quoteTaxonomy'

/** Prefixes used in portal-generated quote numbers (per manager / product line). */
export const QUOTE_NUMBER_PREFIXES = ['RRD', 'SWD', 'IRD'] as const
export type QuoteNumberPrefix = (typeof QUOTE_NUMBER_PREFIXES)[number]

export function isQuoteNumberPrefix(v: string): v is QuoteNumberPrefix {
  return (QUOTE_NUMBER_PREFIXES as readonly string[]).includes(v)
}

/** Local calendar YYYYMMDD (browser or server `Date`). */
export function localDateKeyYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
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

export function buildQuoteNumber(prefix: QuoteNumberPrefix, dateKey: string, sequence: number): string {
  return `${prefix}-${dateKey}-${padSequence(prefix, sequence)}`
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Max numeric suffix for `PREFIX-YYYYMMDD-###` rows. Returns 0 if none.
 */
export function maxSequenceForPrefixDate(quoteNumbers: string[], prefix: QuoteNumberPrefix, dateKey: string): number {
  const re = new RegExp(`^${escapeRegExp(prefix)}-${escapeRegExp(dateKey)}-(\\d+)$`)
  let max = 0
  for (const q of quoteNumbers) {
    const m = String(q ?? '').trim().match(re)
    if (!m) continue
    const n = parseInt(m[1], 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}
