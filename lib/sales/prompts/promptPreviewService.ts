import type { SupabaseClient } from '@supabase/supabase-js'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import { buildEmailGenerationPromptBundle } from '@/lib/sales/generation/emailPromptBuilder'
import { resolvePromptForGeneration } from '@/lib/sales/prompts/resolvePromptForGeneration'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import { DEFAULT_SALES_PROMPT_USE_CASE } from '@/lib/sales/constants/useCaseSlugs'
import { inferProductSlugFromCampaignTypeName } from '@/lib/sales/prompts/industryCategoryMap'
import { getSalesCampaignTypeById } from '@/lib/sales/repositories/salesCampaignTypeRepository'
import { getActiveSalesAiPrompt } from '@/lib/sales/repositories/salesAiPromptRepository'
import { previewPlaceholderBusiness } from '@/lib/sales/prompts/previewPlaceholderBusiness'

export async function ensureActivePromptForCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const campaign = await getSalesCampaignById(supabase, campaignId)
  if (!campaign) throw new Error('Campaign not found.')

  const campaignType = await getSalesCampaignTypeById(supabase, campaign.campaign_type_id)
  const productSlug = campaignType ? inferProductSlugFromCampaignTypeName(campaignType.name) : null
  if (!productSlug) {
    throw new Error('Campaign type is not mapped to a product line in the Prompt Library.')
  }

  const prompt = await getActiveSalesAiPrompt(supabase, {
    productSlug,
    industrySlug: 'general',
    useCaseSlug: DEFAULT_SALES_PROMPT_USE_CASE,
  })

  if (!prompt) {
    throw new Error('No active Prompt Library entry for this product line. Publish a prompt first.')
  }
}

export type BuildPromptPreviewInput = {
  campaignId?: string
  campaignTypeId?: string
  productSlug?: import('@/lib/sales/constants/productLineSlugs').SalesProductLineSlug
  industrySlug?: import('@/lib/sales/constants/industrySlugs').SalesIndustrySlug
  useCaseSlug?: SalesPromptUseCaseSlug
  contactId?: string
  businessCategory?: string
}

export async function buildPromptPreview(
  supabase: SupabaseClient,
  input: BuildPromptPreviewInput,
) {
  let campaign = input.campaignId
    ? await getSalesCampaignById(supabase, input.campaignId)
    : null

  if (!campaign && input.campaignTypeId) {
    campaign = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Preview campaign',
      campaign_type_id: input.campaignTypeId,
      offer_type_id: input.campaignTypeId,
      status: 'draft',
      total_businesses: 1,
      total_contacts: 1,
      created_by: null,
      created_at: new Date().toISOString(),
    }
  }

  if (!campaign) {
    throw new Error('campaignId or campaignTypeId is required for preview.')
  }

  let contact = input.contactId
    ? (await listSalesContactsByIds(supabase, [input.contactId]))[0]
    : undefined

  const business = contact
    ? await getSalesBusinessById(supabase, contact.business_id)
    : previewPlaceholderBusiness(input.businessCategory ?? 'warehousing')

  if (!business) {
    throw new Error('Business not found for preview.')
  }

  if (!contact) {
    contact = {
      id: '00000000-0000-0000-0000-000000000001',
      business_id: business!.id,
      email: 'operations@example.com.au',
      phone: null,
      contact_page: null,
      contact_type: 'general',
      confidence_score: 80,
      is_primary: true,
      source: 'manual',
      email_verified: false,
      verification_status: 'unknown',
      created_at: new Date().toISOString(),
      discovery_page_title: null,
      discovery_method: null,
      page_kind: null,
      recommended_for_outreach: false,
      recommended_reason: null,
      discovered_at: new Date().toISOString(),
    }
  }

  if (input.businessCategory) {
    business.category = input.businessCategory
  }

  const resolved = await resolvePromptForGeneration(supabase, {
    campaign,
    business: business!,
    useCaseSlug: input.useCaseSlug,
  })

  const bundle = await buildEmailGenerationPromptBundle(supabase, {
    campaign,
    contact,
    business: business!,
    useCaseSlug: resolved.useCaseSlug,
  })

  return {
    ...bundle,
    product_slug: resolved.productSlug,
    industry_slug: resolved.industrySlug,
    use_case_slug: resolved.useCaseSlug,
    resolution_path: resolved.resolutionPath,
  }
}
