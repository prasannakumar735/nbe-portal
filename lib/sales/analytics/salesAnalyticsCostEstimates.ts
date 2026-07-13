/** Read-only analytics cost models (dashboard estimates; does not affect billing workers). */

/** USD per Google Places Text Search invocation (override via env). */
export function googlePlacesUsdPerScanRun(): number {
  const raw = process.env.SALES_ANALYTICS_GOOGLE_PLACES_USD_PER_SCAN
  const n = raw != null ? Number(raw) : 0.032
  return Number.isFinite(n) && n >= 0 ? n : 0.032
}

export function estimateGooglePlacesCostUsd(completedScanRuns: number): number {
  return Math.round(completedScanRuns * googlePlacesUsdPerScanRun() * 1_000_000) / 1_000_000
}

export function computeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 1000
}

export function computeRoiRatio(revenueUsd: number, spendUsd: number): number | null {
  if (spendUsd <= 0) return null
  return Math.round((revenueUsd / spendUsd) * 1000) / 1000
}

export function computeRoiPercent(revenueUsd: number, spendUsd: number): number | null {
  if (spendUsd <= 0) return null
  return Math.round(((revenueUsd - spendUsd) / spendUsd) * 1000) / 1000
}

/** Fallback when generation logs omit `estimated_cost` (read-only estimate). */
export function estimateLlmCostUsdFromTokens(
  promptTokens: number,
  completionTokens: number,
): number {
  const inputUsdPer1M = Number(process.env.SALES_ANALYTICS_LLM_USD_PER_1M_INPUT ?? '0.15')
  const outputUsdPer1M = Number(process.env.SALES_ANALYTICS_LLM_USD_PER_1M_OUTPUT ?? '0.6')
  const inRate = Number.isFinite(inputUsdPer1M) ? inputUsdPer1M : 0.15
  const outRate = Number.isFinite(outputUsdPer1M) ? outputUsdPer1M : 0.6
  const cost =
    (promptTokens / 1_000_000) * inRate + (completionTokens / 1_000_000) * outRate
  return Math.round(cost * 1_000_000) / 1_000_000
}
