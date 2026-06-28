/** Supabase `pvc_quotes` total column (live schema uses `total_price`, not `final_price`). */
export const PVC_QUOTES_TOTAL_PRICE_COLUMN = 'total_price' as const

export function readPvcQuoteTotal(row: {
  total_price?: number | null
  final_price?: number | null
}): number {
  const v = row.total_price ?? row.final_price
  return Number(v) || 0
}
