import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesAiPrompt } from '@/lib/sales/types/aiPrompt.types'
import { DEFAULT_SALES_PROMPT_USE_CASE } from '@/lib/sales/constants/useCaseSlugs'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import { getActiveSalesAiPrompt } from '@/lib/sales/repositories/salesAiPromptRepository'
import { getSalesCampaignTypeById } from '@/lib/sales/repositories/salesCampaignTypeRepository'
import {
  inferIndustrySlugFromBusinessCategory,
  inferProductSlugFromCampaignTypeName,
} from '@/lib/sales/prompts/industryCategoryMap'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesBusiness } from '@/lib/sales/types/business.types'

export type ResolvePromptInput = {
  campaign: SalesCampaign
  business: SalesBusiness
  useCaseSlug?: SalesPromptUseCaseSlug
}

export type ResolvedPrompt = {
  prompt: SalesAiPrompt
  productSlug: SalesProductLineSlug
  industrySlug: SalesIndustrySlug
  useCaseSlug: SalesPromptUseCaseSlug
  resolutionPath: string[]
}

async function resolveProductSlug(
  supabase: SupabaseClient,
  campaign: SalesCampaign,
): Promise<SalesProductLineSlug | null> {
  const campaignType = await getSalesCampaignTypeById(supabase, campaign.campaign_type_id)
  if (!campaignType) return null
  return inferProductSlugFromCampaignTypeName(campaignType.name)
}

export async function resolvePromptForGeneration(
  supabase: SupabaseClient,
  input: ResolvePromptInput,
): Promise<ResolvedPrompt> {
  const useCaseSlug = input.useCaseSlug ?? DEFAULT_SALES_PROMPT_USE_CASE
  const resolutionPath: string[] = []

  const productSlug = await resolveProductSlug(supabase, input.campaign)
  if (!productSlug) {
    throw new Error('Could not map campaign to a product line for prompt resolution.')
  }
  resolutionPath.push(`product:${productSlug}`)

  const industrySlug = inferIndustrySlugFromBusinessCategory(input.business.category)
  resolutionPath.push(`industry:${industrySlug}`)
  resolutionPath.push(`use_case:${useCaseSlug}`)

  let prompt = await getActiveSalesAiPrompt(supabase, {
    productSlug,
    industrySlug,
    useCaseSlug,
  })
  if (prompt) {
    resolutionPath.push('matched:exact_slot')
  } else if (industrySlug !== 'general') {
    prompt = await getActiveSalesAiPrompt(supabase, {
      productSlug,
      industrySlug: 'general',
      useCaseSlug,
    })
    if (prompt) resolutionPath.push('fallback:general_industry')
  }

  if (!prompt) {
    throw new Error(
      `No active prompt for ${productSlug} / ${industrySlug} / ${useCaseSlug}. Configure the Prompt Library.`,
    )
  }

  return {
    prompt,
    productSlug,
    industrySlug,
    useCaseSlug,
    resolutionPath,
  }
}
