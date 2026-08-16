import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeRate,
  computeRoiRatio,
  estimateGooglePlacesCostUsd,
  estimateLlmCostUsdFromTokens,
} from '@/lib/sales/analytics/salesAnalyticsCostEstimates'
import {
  buildTopIndustriesFromBusinessRows,
} from '@/lib/sales/analytics/salesAnalyticsRepository'

describe('salesAnalyticsCostEstimates', () => {
  it('computes open/reply rates', () => {
    assert.equal(computeRate(25, 100), 0.25)
    assert.equal(computeRate(0, 0), null)
  })

  it('estimates Google Places cost from scan runs', () => {
    assert.equal(estimateGooglePlacesCostUsd(10), 0.32)
  })

  it('estimates LLM cost from tokens when logs omit cost', () => {
    const cost = estimateLlmCostUsdFromTokens(1_000_000, 500_000)
    assert.ok(cost > 0)
  })

  it('computes ROI ratio', () => {
    assert.equal(computeRoiRatio(300, 100), 3)
  })
})

describe('buildTopIndustriesFromBusinessRows', () => {
  it('ranks categories', () => {
    const top = buildTopIndustriesFromBusinessRows(
      [
        { category: 'Warehouse' },
        { category: 'Warehouse' },
        { category: 'Retail' },
      ],
      2,
    )
    assert.equal(top[0]?.label, 'Warehouse')
    assert.equal(top[0]?.count, 2)
  })
})
