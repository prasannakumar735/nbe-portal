import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesPipelineStage } from '@/lib/sales/constants/pipelineStages'
import {
  isTerminalSalesPipelineStage,
  SALES_PIPELINE_OPEN_STAGES,
} from '@/lib/sales/constants/pipelineStages'
import { defaultProbabilityForStage } from '@/lib/sales/pipeline/pipelineAnalytics'
import type {
  SalesPipelineOpportunity,
  SalesPipelineOpportunityInsert,
  SalesPipelineOpportunityListItem,
  SalesPipelineOpportunityListOptions,
  SalesPipelineOpportunityPatch,
} from '@/lib/sales/types/pipeline.types'

const TABLE = 'sales_pipeline_opportunities'
const HISTORY_TABLE = 'sales_pipeline_stage_history'

const LIST_SELECT = `
  *,
  business:sales_businesses!business_id ( company_name, postcode, suburb ),
  contact:sales_contacts!contact_id ( email )
`

function mapRow(row: Record<string, unknown>): SalesPipelineOpportunity {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    contact_id: row.contact_id != null ? String(row.contact_id) : null,
    campaign_id: row.campaign_id != null ? String(row.campaign_id) : null,
    title: String(row.title),
    stage: row.stage as SalesPipelineStage,
    revenue_cents: Number(row.revenue_cents),
    probability_percent: Number(row.probability_percent),
    inspection_value_cents: Number(row.inspection_value_cents),
    owner_user_id: row.owner_user_id != null ? String(row.owner_user_id) : null,
    next_follow_up_at: row.next_follow_up_at != null ? String(row.next_follow_up_at) : null,
    notes: String(row.notes ?? ''),
    closed_at: row.closed_at != null ? String(row.closed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapListRow(row: Record<string, unknown>): SalesPipelineOpportunityListItem {
  const base = mapRow(row)
  const businessRaw = row.business as Record<string, unknown> | null | undefined
  const contactRaw = row.contact as Record<string, unknown> | null | undefined
  return {
    ...base,
    business: businessRaw
      ? {
          company_name: String(businessRaw.company_name),
          postcode: String(businessRaw.postcode),
          suburb: businessRaw.suburb != null ? String(businessRaw.suburb) : null,
        }
      : null,
    contact: contactRaw
      ? { email: contactRaw.email != null ? String(contactRaw.email) : null }
      : null,
  }
}

export async function listSalesPipelineOpportunities(
  supabase: SupabaseClient,
  options?: SalesPipelineOpportunityListOptions,
): Promise<SalesPipelineOpportunityListItem[]> {
  let query = supabase
    .from(TABLE)
    .select(LIST_SELECT)
    .order('updated_at', { ascending: false })

  if (options?.stage) {
    query = query.eq('stage', options.stage)
  }
  if (options?.ownerUserId) {
    query = query.eq('owner_user_id', options.ownerUserId)
  }
  if (options?.openOnly) {
    query = query.in('stage', [...SALES_PIPELINE_OPEN_STAGES])
  }
  if (options?.limit != null) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapListRow(row as Record<string, unknown>))
}

export async function listSalesPipelineOpportunitiesForAnalytics(
  supabase: SupabaseClient,
): Promise<SalesPipelineOpportunity[]> {
  const { data, error } = await supabase.from(TABLE).select('*').limit(5000)
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function getSalesPipelineOpportunityById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesPipelineOpportunityListItem | null> {
  const { data, error } = await supabase.from(TABLE).select(LIST_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapListRow(data as Record<string, unknown>)
}

export async function createSalesPipelineOpportunity(
  supabase: SupabaseClient,
  row: SalesPipelineOpportunityInsert,
): Promise<SalesPipelineOpportunity> {
  const stage = row.stage ?? 'lead'
  const probability =
    row.probability_percent ?? defaultProbabilityForStage(stage)
  const now = new Date().toISOString()
  const closed_at = isTerminalSalesPipelineStage(stage) ? now : null

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      business_id: row.business_id,
      contact_id: row.contact_id ?? null,
      campaign_id: row.campaign_id ?? null,
      title: row.title,
      stage,
      revenue_cents: row.revenue_cents ?? 0,
      probability_percent: probability,
      inspection_value_cents: row.inspection_value_cents ?? 0,
      owner_user_id: row.owner_user_id ?? null,
      next_follow_up_at: row.next_follow_up_at ?? null,
      notes: row.notes ?? '',
      closed_at,
      updated_at: now,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function updateSalesPipelineOpportunity(
  supabase: SupabaseClient,
  id: string,
  patch: SalesPipelineOpportunityPatch,
  changedByUserId?: string | null,
): Promise<SalesPipelineOpportunity> {
  const existing = await getSalesPipelineOpportunityById(supabase, id)
  if (!existing) {
    throw new Error('Opportunity not found.')
  }

  const nextStage = patch.stage ?? existing.stage
  const stageChanged = patch.stage != null && patch.stage !== existing.stage

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (patch.title != null) updatePayload.title = patch.title
  if (patch.contact_id !== undefined) updatePayload.contact_id = patch.contact_id
  if (patch.campaign_id !== undefined) updatePayload.campaign_id = patch.campaign_id
  if (patch.revenue_cents != null) updatePayload.revenue_cents = patch.revenue_cents
  if (patch.inspection_value_cents != null) {
    updatePayload.inspection_value_cents = patch.inspection_value_cents
  }
  if (patch.owner_user_id !== undefined) updatePayload.owner_user_id = patch.owner_user_id
  if (patch.next_follow_up_at !== undefined) updatePayload.next_follow_up_at = patch.next_follow_up_at
  if (patch.notes != null) updatePayload.notes = patch.notes

  if (stageChanged) {
    updatePayload.stage = nextStage
    if (patch.probability_percent == null) {
      updatePayload.probability_percent = defaultProbabilityForStage(nextStage)
    }
    if (isTerminalSalesPipelineStage(nextStage)) {
      updatePayload.closed_at = new Date().toISOString()
    } else {
      updatePayload.closed_at = null
    }
  }

  if (patch.probability_percent != null) {
    updatePayload.probability_percent = patch.probability_percent
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error

  if (stageChanged) {
    const { error: histErr } = await supabase.from(HISTORY_TABLE).insert({
      opportunity_id: id,
      from_stage: existing.stage,
      to_stage: nextStage,
      changed_by_user_id: changedByUserId ?? null,
    })
    if (histErr) throw histErr
  }

  return mapRow(data as Record<string, unknown>)
}

export async function listSalesPipelineOwnerProfiles(
  supabase: SupabaseClient,
): Promise<{ id: string; full_name: string | null; first_name: string | null; last_name: string | null }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, first_name, last_name')
    .in('role', ['manager', 'admin'])
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as {
    id: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
  }[]
}
