import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPipelineDashboard } from '@/lib/sales/pipeline/pipelineAnalytics'
import type { PipelineAnalyticsRow } from '@/lib/sales/pipeline/pipelineAnalytics'

const base = (overrides: Partial<PipelineAnalyticsRow>): PipelineAnalyticsRow => ({
  stage: 'lead',
  revenue_cents: 0,
  probability_percent: 10,
  inspection_value_cents: 0,
  next_follow_up_at: null,
  closed_at: null,
  ...overrides,
})

describe('buildPipelineDashboard', () => {
  it('computes forecast from open deals only', () => {
    const rows: PipelineAnalyticsRow[] = [
      base({ stage: 'qualified', revenue_cents: 100_000, probability_percent: 50 }),
      base({ stage: 'won', revenue_cents: 200_000, probability_percent: 100 }),
      base({ stage: 'lost', revenue_cents: 50_000, probability_percent: 0 }),
    ]
    const dash = buildPipelineDashboard(rows, new Date('2026-07-05T00:00:00Z'))
    assert.equal(dash.forecast_cents, 50_000)
    assert.equal(dash.conversion.won, 1)
    assert.equal(dash.conversion.lost, 1)
    assert.equal(dash.conversion.win_rate, 0.5)
  })

  it('counts follow-ups due', () => {
    const rows: PipelineAnalyticsRow[] = [
      base({
        stage: 'lead',
        next_follow_up_at: '2026-07-04T12:00:00Z',
      }),
      base({
        stage: 'negotiation',
        next_follow_up_at: '2026-07-10T12:00:00Z',
      }),
    ]
    const dash = buildPipelineDashboard(rows, new Date('2026-07-05T00:00:00Z'))
    assert.equal(dash.follow_up_due_count, 1)
  })

  it('sums inspection value across opportunities', () => {
    const rows: PipelineAnalyticsRow[] = [
      base({ inspection_value_cents: 12_500 }),
      base({ stage: 'inspection_scheduled', inspection_value_cents: 7_500 }),
    ]
    const dash = buildPipelineDashboard(rows)
    assert.equal(dash.inspection_value_cents, 20_000)
  })
})
