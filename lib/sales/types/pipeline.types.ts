import type { SalesPipelineStage } from '@/lib/sales/constants/pipelineStages'

export type SalesPipelineOpportunity = {
  id: string
  business_id: string
  contact_id: string | null
  campaign_id: string | null
  title: string
  stage: SalesPipelineStage
  revenue_cents: number
  probability_percent: number
  inspection_value_cents: number
  owner_user_id: string | null
  next_follow_up_at: string | null
  notes: string
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type SalesPipelineOpportunityBusinessSummary = {
  company_name: string
  postcode: string
  suburb: string | null
}

export type SalesPipelineOpportunityContactSummary = {
  email: string | null
}

export type SalesPipelineOpportunityListItem = SalesPipelineOpportunity & {
  business: SalesPipelineOpportunityBusinessSummary | null
  contact: SalesPipelineOpportunityContactSummary | null
}

export type SalesPipelineOpportunityInsert = {
  business_id: string
  contact_id?: string | null
  campaign_id?: string | null
  title: string
  stage?: SalesPipelineStage
  revenue_cents?: number
  probability_percent?: number
  inspection_value_cents?: number
  owner_user_id?: string | null
  next_follow_up_at?: string | null
  notes?: string
}

export type SalesPipelineOpportunityPatch = {
  title?: string
  stage?: SalesPipelineStage
  contact_id?: string | null
  campaign_id?: string | null
  revenue_cents?: number
  probability_percent?: number
  inspection_value_cents?: number
  owner_user_id?: string | null
  next_follow_up_at?: string | null
  notes?: string
}

export type SalesPipelineOpportunityListOptions = {
  stage?: SalesPipelineStage
  ownerUserId?: string
  openOnly?: boolean
  limit?: number
}

export type SalesPipelineStageBucket = {
  stage: SalesPipelineStage
  count: number
  revenue_cents: number
  weighted_revenue_cents: number
  inspection_value_cents: number
}

export type SalesPipelineDashboard = {
  pipeline: SalesPipelineStageBucket[]
  forecast_cents: number
  total_open_revenue_cents: number
  inspection_value_cents: number
  conversion: {
    total: number
    won: number
    lost: number
    open: number
    win_rate: number | null
    stage_funnel: { stage: SalesPipelineStage; reached_count: number; rate_from_lead: number | null }[]
  }
  follow_up_due_count: number
}

export type SalesPipelineOwnerOption = {
  id: string
  label: string
}
