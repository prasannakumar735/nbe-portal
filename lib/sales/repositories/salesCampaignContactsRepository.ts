import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SalesCampaignContact,
  SalesCampaignContactInsert,
} from '@/lib/sales/types/campaign.types'

const TABLE = 'sales_campaign_contacts'

function mapRow(row: Record<string, unknown>): SalesCampaignContact {
  return {
    id: String(row.id),
    campaign_id: String(row.campaign_id),
    contact_id: String(row.contact_id),
    business_id: String(row.business_id),
    selected: Boolean(row.selected),
    created_at: String(row.created_at),
  }
}

export async function insertSalesCampaignContacts(
  supabase: SupabaseClient,
  rows: SalesCampaignContactInsert[],
): Promise<SalesCampaignContact[]> {
  if (rows.length === 0) return []

  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      rows.map((r) => ({
        campaign_id: r.campaign_id,
        contact_id: r.contact_id,
        business_id: r.business_id,
        selected: r.selected ?? true,
      })),
    )
    .select('*')
  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}
