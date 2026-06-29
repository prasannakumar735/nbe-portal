import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesCampaignTypeRecord } from '@/lib/sales/types/campaignLookup.types'

const TABLE = 'sales_campaign_types'

function mapRow(row: Record<string, unknown>): SalesCampaignTypeRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  }
}

export async function listSalesCampaignTypes(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean },
): Promise<SalesCampaignTypeRecord[]> {
  let query = supabase.from(TABLE).select('*').order('name', { ascending: true })
  if (options?.activeOnly) {
    query = query.eq('is_active', true)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function getSalesCampaignTypeById(
  supabase: SupabaseClient,
  id: string,
): Promise<SalesCampaignTypeRecord | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}
