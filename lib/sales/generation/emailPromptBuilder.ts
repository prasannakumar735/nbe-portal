import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesBusiness } from '@/lib/sales/types/business.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import { getSalesCampaignTypeById } from '@/lib/sales/repositories/salesCampaignTypeRepository'
import { getSalesOfferTypeById } from '@/lib/sales/repositories/salesOfferTypeRepository'
import { assembleGenerationPrompts, type AssembledGenerationPrompts } from '@/lib/sales/prompts/assembleGenerationPrompts'
import { buildPromptRenderVariables } from '@/lib/sales/prompts/buildPromptRenderVariables'
import { resolvePromptForGeneration } from '@/lib/sales/prompts/resolvePromptForGeneration'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'

export type EmailGenerationPromptBundle = AssembledGenerationPrompts

export async function buildEmailGenerationPromptBundle(
  supabase: SupabaseClient,
  input: {
    campaign: SalesCampaign
    contact: SalesContact
    business: SalesBusiness
    useCaseSlug?: SalesPromptUseCaseSlug
  },
): Promise<EmailGenerationPromptBundle> {
  const [campaignType, offerType, resolved] = await Promise.all([
    getSalesCampaignTypeById(supabase, input.campaign.campaign_type_id),
    getSalesOfferTypeById(supabase, input.campaign.offer_type_id),
    resolvePromptForGeneration(supabase, {
      campaign: input.campaign,
      business: input.business,
      useCaseSlug: input.useCaseSlug,
    }),
  ])

  const variables = buildPromptRenderVariables({
    campaign: input.campaign,
    contact: input.contact,
    business: input.business,
    campaignTypeName: campaignType?.name ?? 'Unknown',
    offerTypeName: offerType?.name ?? 'Unknown',
    productSlug: resolved.productSlug,
    industrySlug: resolved.industrySlug,
    useCaseSlug: resolved.useCaseSlug,
  })

  return assembleGenerationPrompts(resolved.prompt, variables)
}

/** @deprecated Use buildEmailGenerationPromptBundle for system + user prompts. */
export async function buildEmailGenerationPrompt(
  supabase: SupabaseClient,
  input: {
    campaign: SalesCampaign
    contact: SalesContact
    business: SalesBusiness
  },
): Promise<string> {
  const bundle = await buildEmailGenerationPromptBundle(supabase, input)
  return bundle.userPrompt
}
