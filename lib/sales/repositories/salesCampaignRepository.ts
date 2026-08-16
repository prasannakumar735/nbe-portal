import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesCampaign, SalesCampaignInsert } from '@/lib/sales/types/campaign.types'

const TABLE = 'sales_campaigns'

function mapRow(row: Record<string, unknown>): SalesCampaign {
  return {
    id: String(row.id),
    name: String(row.name),
    campaign_type_id: String(row.campaign_type_id),
    offer_type_id: String(row.offer_type_id),
    status: row.status as SalesCampaign['status'],
    total_businesses: Number(row.total_businesses ?? 0),
    total_contacts: Number(row.total_contacts ?? 0),
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at),
  }
}

export async function createSalesCampaign(
  supabase: SupabaseClient,
  row: SalesCampaignInsert,
): Promise<SalesCampaign> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: row.name,
      campaign_type_id: row.campaign_type_id,
      offer_type_id: row.offer_type_id,
      status: row.status ?? 'draft',
      total_businesses: row.total_businesses,
      total_contacts: row.total_contacts,
      created_by: row.created_by ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function getSalesCampaignById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesCampaign | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}
