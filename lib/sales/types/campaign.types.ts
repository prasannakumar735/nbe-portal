import type { SalesCampaignStatus } from '@/lib/sales/constants/campaignStatuses'

export type { SalesCampaignStatus } from '@/lib/sales/constants/campaignStatuses'
export { SALES_CAMPAIGN_STATUSES } from '@/lib/sales/constants/campaignStatuses'

export type SalesCampaign = {
  id: string
  name: string
  campaign_type_id: string
  offer_type_id: string
  status: SalesCampaignStatus
  total_businesses: number
  total_contacts: number
  created_by: string | null
  created_at: string
}

export type SalesCampaignInsert = {
  name: string
  campaign_type_id: string
  offer_type_id: string
  status?: SalesCampaignStatus
  total_businesses: number
  total_contacts: number
  created_by?: string | null
}

export type SalesCampaignContact = {
  id: string
  campaign_id: string
  contact_id: string
  business_id: string
  selected: boolean
  created_at: string
}

export type SalesCampaignContactInsert = {
  campaign_id: string
  contact_id: string
  business_id: string
  selected?: boolean
}

export type CreateSalesCampaignResult = {
  campaign: SalesCampaign
}
