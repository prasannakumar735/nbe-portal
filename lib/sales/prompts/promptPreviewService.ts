import type { SupabaseClient } from '@supabase/supabase-js'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import { getSalesAiPromptById } from '@/lib/sales/repositories/salesAiPromptRepository'
import {
  composePromptBundle,
  composePromptBundleFromLibraryRow,
} from '@/lib/sales/prompts/promptPreviewFoundation'
import {
  resolveActivePromptForSlot,
  resolveProductSlugForCampaign,
} from '@/lib/sales/prompts/promptResolver'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import { DEFAULT_SALES_PROMPT_USE_CASE } from '@/lib/sales/constants/useCaseSlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import { previewPlaceholderBusiness } from '@/lib/sales/prompts/previewPlaceholderBusiness'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'

export async function ensureActivePromptForCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const campaign = await getSalesCampaignById(supabase, campaignId)
  if (!campaign) throw new Error('Campaign not found.')

  const productSlug = await resolveProductSlugForCampaign(supabase, campaign)
  if (!productSlug) {
    throw new Error('Campaign type is not mapped to a product line in the Prompt Library.')
  }

  await resolveActivePromptForSlot(supabase, {
    productSlug,
    industrySlug: 'general',
    useCaseSlug: DEFAULT_SALES_PROMPT_USE_CASE,
  })
}

export type BuildPromptPreviewInput = {
  promptId?: string
  campaignId?: string
  campaignTypeId?: string
  productSlug?: SalesProductLineSlug
  industrySlug?: SalesIndustrySlug
  useCaseSlug?: SalesPromptUseCaseSlug
  contactId?: string
  businessCategory?: string
}

function previewContact(businessId: string): SalesContact {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    business_id: businessId,
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

function previewCampaign(campaignTypeId: string): SalesCampaign {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Preview Campaign',
    campaign_type_id: campaignTypeId,
    offer_type_id: campaignTypeId,
    status: 'draft',
    total_businesses: 1,
    total_contacts: 1,
    created_by: null,
    created_at: new Date().toISOString(),
  }
}

/** Load campaign/contact context and return assembled prompts (preview foundation). */
export async function buildPromptPreview(
  supabase: SupabaseClient,
  input: BuildPromptPreviewInput,
) {
  if (input.promptId) {
    const prompt = await getSalesAiPromptById(supabase, input.promptId)
    if (!prompt) throw new Error('Prompt not found.')
    return composePromptBundleFromLibraryRow(prompt, [
      'direct:library_id',
      `id:${prompt.id}`,
      `version:${prompt.version}`,
      prompt.is_active ? 'status:active' : 'status:inactive',
    ])
  }

  if (input.productSlug && input.industrySlug) {
    const useCaseSlug = input.useCaseSlug ?? DEFAULT_SALES_PROMPT_USE_CASE
    const resolved = await resolveActivePromptForSlot(supabase, {
      productSlug: input.productSlug,
      industrySlug: input.industrySlug,
      useCaseSlug,
    })
    return composePromptBundleFromLibraryRow(resolved.prompt, resolved.resolutionPath)
  }

  let campaign = input.campaignId
    ? await getSalesCampaignById(supabase, input.campaignId)
    : null

  if (!campaign && input.campaignTypeId) {
    campaign = previewCampaign(input.campaignTypeId)
  }

  if (!campaign) {
    throw new Error(
      'Provide promptId, productSlug+industrySlug, campaignId, or campaignTypeId for preview.',
    )
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
    contact = previewContact(business.id)
  }

  if (input.businessCategory) {
    business.category = input.businessCategory
  }

  return composePromptBundle(supabase, {
    campaign,
    contact,
    business,
    useCaseSlug: input.useCaseSlug,
    previewMode: true,
  })
}

export type { PromptPreviewFoundationResult } from '@/lib/sales/prompts/promptPreviewFoundation'
export { PROMPT_RENDER_VARIABLE_KEYS } from '@/lib/sales/prompts/variableRendering'
