import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesAiPrompt } from '@/lib/sales/types/aiPrompt.types'
import { DEFAULT_SALES_PROMPT_USE_CASE } from '@/lib/sales/constants/useCaseSlugs'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import { getActiveSalesAiPrompt, listSalesAiPrompts } from '@/lib/sales/repositories/salesAiPromptRepository'
import { ensurePromptLibrarySlotWithFallbacks } from '@/lib/sales/prompts/seed/ensurePromptLibrarySlot'
import { getSalesCampaignTypeById } from '@/lib/sales/repositories/salesCampaignTypeRepository'
import {
  inferIndustrySlugFromBusinessCategory,
  inferProductSlugFromCampaignTypeName,
} from '@/lib/sales/prompts/industryCategoryMap'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesBusiness } from '@/lib/sales/types/business.types'

export type PromptResolutionSlot = {
  productSlug: SalesProductLineSlug
  industrySlug: SalesIndustrySlug
  useCaseSlug: SalesPromptUseCaseSlug
}

export type ResolvedPrompt = PromptResolutionSlot & {
  prompt: SalesAiPrompt
  resolutionPath: string[]
}

/**
 * Load active library row for product × industry × use case, with industry → general fallback.
 */
export async function resolveActivePromptForSlot(
  supabase: SupabaseClient,
  slot: PromptResolutionSlot,
): Promise<ResolvedPrompt> {
  const resolutionPath: string[] = [
    `product:${slot.productSlug}`,
    `industry:${slot.industrySlug}`,
    `use_case:${slot.useCaseSlug}`,
  ]

  let prompt = await getActiveSalesAiPrompt(supabase, {
    productSlug: slot.productSlug,
    industrySlug: slot.industrySlug,
    useCaseSlug: slot.useCaseSlug,
  })

  if (prompt) {
    resolutionPath.push('matched:exact_slot')
  } else if (slot.industrySlug !== 'general') {
    prompt = await getActiveSalesAiPrompt(supabase, {
      productSlug: slot.productSlug,
      industrySlug: 'general',
      useCaseSlug: slot.useCaseSlug,
    })
    if (prompt) {
      resolutionPath.push('fallback:general_industry')
    }
  }

  if (!prompt) {
    await ensurePromptLibrarySlotWithFallbacks(supabase, slot)
    prompt = await getActiveSalesAiPrompt(supabase, {
      productSlug: slot.productSlug,
      industrySlug: slot.industrySlug,
      useCaseSlug: slot.useCaseSlug,
    })
    if (prompt) {
      resolutionPath.push('seeded:default_catalog')
    }
  }

  if (!prompt && slot.industrySlug !== 'general') {
    await ensurePromptLibrarySlotWithFallbacks(supabase, {
      ...slot,
      industrySlug: 'general',
    })
    prompt = await getActiveSalesAiPrompt(supabase, {
      productSlug: slot.productSlug,
      industrySlug: 'general',
      useCaseSlug: slot.useCaseSlug,
    })
    if (prompt) {
      resolutionPath.push('seeded:general_industry')
    }
  }

  if (!prompt) {
    const alternates = await listSalesAiPrompts(supabase, {
      productSlug: slot.productSlug,
      useCaseSlug: slot.useCaseSlug,
      activeOnly: true,
      limit: 50,
    })
    const generalAlt = alternates.find((p) => p.industry_slug === 'general')
    prompt = generalAlt ?? alternates[0] ?? null
    if (prompt) {
      resolutionPath.push('fallback:any_active_product_use_case')
    }
  }

  if (!prompt) {
    throw new Error(
      `No active prompt for ${slot.productSlug} / ${slot.industrySlug} / ${slot.useCaseSlug}. ` +
        'Open Prompt Library (/dashboard/sales-engine/prompt-library), publish and activate a row for this slot, ' +
        'or seed defaults: npx tsx --env-file=.env.local scripts/seed-sales-ai-prompts.ts',
    )
  }

  return {
    prompt,
    productSlug: slot.productSlug,
    industrySlug: slot.industrySlug,
    useCaseSlug: slot.useCaseSlug,
    resolutionPath,
  }
}

export async function resolveProductSlugForCampaign(
  supabase: SupabaseClient,
  campaign: SalesCampaign,
): Promise<SalesProductLineSlug | null> {
  const campaignType = await getSalesCampaignTypeById(supabase, campaign.campaign_type_id)
  if (!campaignType) return null
  return inferProductSlugFromCampaignTypeName(campaignType.name)
}

export type ResolvePromptForContactInput = {
  campaign: SalesCampaign
  business: SalesBusiness
  useCaseSlug?: SalesPromptUseCaseSlug
}

/** Campaign + business context → product/industry/use case → active prompt row. */
export async function resolvePromptForCampaignContact(
  supabase: SupabaseClient,
  input: ResolvePromptForContactInput,
): Promise<ResolvedPrompt> {
  const useCaseSlug = input.useCaseSlug ?? DEFAULT_SALES_PROMPT_USE_CASE
  const productSlug = await resolveProductSlugForCampaign(supabase, input.campaign)
  if (!productSlug) {
    throw new Error('Could not map campaign to a product line for prompt resolution.')
  }

  const industrySlug = inferIndustrySlugFromBusinessCategory(input.business.category)

  return resolveActivePromptForSlot(supabase, {
    productSlug,
    industrySlug,
    useCaseSlug,
  })
}
