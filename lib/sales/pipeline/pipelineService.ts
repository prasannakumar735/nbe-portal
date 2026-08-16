import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPipelineDashboard } from '@/lib/sales/pipeline/pipelineAnalytics'
import {
  createSalesPipelineOpportunity,
  getSalesPipelineOpportunityById,
  listSalesPipelineOpportunitiesForAnalytics,
  listSalesPipelineOwnerProfiles,
} from '@/lib/sales/repositories/salesPipelineOpportunityRepository'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import type {
  SalesPipelineDashboard,
  SalesPipelineOwnerOption,
} from '@/lib/sales/types/pipeline.types'

export async function getSalesPipelineDashboard(
  supabase: SupabaseClient,
): Promise<SalesPipelineDashboard> {
  const rows = await listSalesPipelineOpportunitiesForAnalytics(supabase)
  return buildPipelineDashboard(rows)
}

export async function listPipelineOwnerOptions(
  supabase: SupabaseClient,
): Promise<SalesPipelineOwnerOption[]> {
  const profiles = await listSalesPipelineOwnerProfiles(supabase)
  return profiles.map((p) => {
    const label =
      p.full_name?.trim() ||
      [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
      p.id.slice(0, 8)
    return { id: p.id, label }
  })
}

export async function createPipelineOpportunityFromBusiness(
  supabase: SupabaseClient,
  input: {
    businessId: string
    contactId?: string | null
    campaignId?: string | null
    title?: string
    ownerUserId?: string | null
  },
) {
  const business = await getSalesBusinessById(supabase, input.businessId)
  if (!business) {
    throw new Error('Business not found.')
  }
  const title = input.title?.trim() || business.company_name
  return createSalesPipelineOpportunity(supabase, {
    business_id: input.businessId,
    contact_id: input.contactId ?? null,
    campaign_id: input.campaignId ?? null,
    title,
    owner_user_id: input.ownerUserId ?? null,
  })
}

export async function loadPipelineOpportunityOrThrow(
  supabase: SupabaseClient,
  id: string,
) {
  const row = await getSalesPipelineOpportunityById(supabase, id)
  if (!row) throw new Error('Opportunity not found.')
  return row
}
