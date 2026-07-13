import {
  SALES_PIPELINE_DEFAULT_PROBABILITY,
  SALES_PIPELINE_STAGES,
  type SalesPipelineStage,
  salesPipelineStageIndex,
} from '@/lib/sales/constants/pipelineStages'
import type {
  SalesPipelineDashboard,
  SalesPipelineOpportunity,
  SalesPipelineStageBucket,
} from '@/lib/sales/types/pipeline.types'

export type PipelineAnalyticsRow = Pick<
  SalesPipelineOpportunity,
  | 'stage'
  | 'revenue_cents'
  | 'probability_percent'
  | 'inspection_value_cents'
  | 'next_follow_up_at'
  | 'closed_at'
>

function emptyBuckets(): SalesPipelineStageBucket[] {
  return SALES_PIPELINE_STAGES.map((stage) => ({
    stage,
    count: 0,
    revenue_cents: 0,
    weighted_revenue_cents: 0,
    inspection_value_cents: 0,
  }))
}

export function buildPipelineStageBuckets(rows: PipelineAnalyticsRow[]): SalesPipelineStageBucket[] {
  const buckets = emptyBuckets()
  const byStage = new Map(buckets.map((b) => [b.stage, b]))

  for (const row of rows) {
    const bucket = byStage.get(row.stage)
    if (!bucket) continue
    bucket.count += 1
    bucket.revenue_cents += row.revenue_cents
    bucket.inspection_value_cents += row.inspection_value_cents
    const prob = row.probability_percent / 100
    bucket.weighted_revenue_cents += Math.round(row.revenue_cents * prob)
  }

  return buckets
}

export function computeForecastCents(rows: PipelineAnalyticsRow[]): number {
  let total = 0
  for (const row of rows) {
    if (row.stage === 'won' || row.stage === 'lost') continue
    total += Math.round((row.revenue_cents * row.probability_percent) / 100)
  }
  return total
}

export function computeTotalInspectionValueCents(rows: PipelineAnalyticsRow[]): number {
  let total = 0
  for (const row of rows) {
    total += row.inspection_value_cents
  }
  return total
}

export function countFollowUpsDue(rows: PipelineAnalyticsRow[], now: Date): number {
  const iso = now.toISOString()
  let count = 0
  for (const row of rows) {
    if (row.stage === 'won' || row.stage === 'lost') continue
    if (row.next_follow_up_at && row.next_follow_up_at <= iso) count += 1
  }
  return count
}

export function buildStageFunnel(rows: PipelineAnalyticsRow[]): SalesPipelineDashboard['conversion']['stage_funnel'] {
  const total = rows.length
  return SALES_PIPELINE_STAGES.map((stage) => {
    const minIndex = salesPipelineStageIndex(stage)
    const reached = rows.filter((r) => salesPipelineStageIndex(r.stage) >= minIndex).length
    return {
      stage,
      reached_count: reached,
      rate_from_lead: total > 0 ? Math.round((reached / total) * 1000) / 1000 : null,
    }
  })
}

export function buildPipelineDashboard(
  rows: PipelineAnalyticsRow[],
  now: Date = new Date(),
): SalesPipelineDashboard {
  const pipeline = buildPipelineStageBuckets(rows)
  const won = rows.filter((r) => r.stage === 'won').length
  const lost = rows.filter((r) => r.stage === 'lost').length
  const open = rows.length - won - lost
  const closed = won + lost

  let totalOpenRevenue = 0
  for (const row of rows) {
    if (row.stage !== 'won' && row.stage !== 'lost') {
      totalOpenRevenue += row.revenue_cents
    }
  }

  return {
    pipeline,
    forecast_cents: computeForecastCents(rows),
    total_open_revenue_cents: totalOpenRevenue,
    inspection_value_cents: computeTotalInspectionValueCents(rows),
    conversion: {
      total: rows.length,
      won,
      lost,
      open,
      win_rate: closed > 0 ? Math.round((won / closed) * 1000) / 1000 : null,
      stage_funnel: buildStageFunnel(rows),
    },
    follow_up_due_count: countFollowUpsDue(rows, now),
  }
}

export function defaultProbabilityForStage(stage: SalesPipelineStage): number {
  return SALES_PIPELINE_DEFAULT_PROBABILITY[stage]
}
