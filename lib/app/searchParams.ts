/**
 * Next.js App Router passes `searchParams` as a Promise (Next 15+).
 * Raw values may be `string`, `string[]`, or undefined.
 */
export type AppSearchParams = Record<string, string | string[] | undefined>

/** First value for a query key (Next may give repeated keys as string[]). */
export function pickSearchParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}
