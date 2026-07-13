/** CRM pipeline stages (ordered funnel). */
export const SALES_PIPELINE_STAGES = [
  'lead',
  'qualified',
  'inspection_scheduled',
  'quote_sent',
  'negotiation',
  'won',
  'lost',
] as const

export type SalesPipelineStage = (typeof SALES_PIPELINE_STAGES)[number]

export const SALES_PIPELINE_STAGE_LABELS: Record<SalesPipelineStage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  inspection_scheduled: 'Inspection Scheduled',
  quote_sent: 'Quote Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

/** Default win probability when stage changes (managers may override). */
export const SALES_PIPELINE_DEFAULT_PROBABILITY: Record<SalesPipelineStage, number> = {
  lead: 10,
  qualified: 25,
  inspection_scheduled: 40,
  quote_sent: 55,
  negotiation: 75,
  won: 100,
  lost: 0,
}

export const SALES_PIPELINE_OPEN_STAGES = SALES_PIPELINE_STAGES.filter(
  (s) => s !== 'won' && s !== 'lost',
) as Exclude<SalesPipelineStage, 'won' | 'lost'>[]

export function salesPipelineStageIndex(stage: SalesPipelineStage): number {
  return SALES_PIPELINE_STAGES.indexOf(stage)
}

export function isTerminalSalesPipelineStage(stage: SalesPipelineStage): boolean {
  return stage === 'won' || stage === 'lost'
}
