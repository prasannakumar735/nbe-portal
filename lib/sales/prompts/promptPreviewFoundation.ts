import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesBusiness } from '@/lib/sales/types/business.types'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import type { SalesAiPrompt } from '@/lib/sales/types/aiPrompt.types'
import { getSalesCampaignTypeById } from '@/lib/sales/repositories/salesCampaignTypeRepository'
import { getSalesOfferTypeById } from '@/lib/sales/repositories/salesOfferTypeRepository'
import { assemblePromptFromLibrary } from '@/lib/sales/prompts/promptAssembler'
import { buildPromptRenderVariables } from '@/lib/sales/prompts/buildPromptRenderVariables'
import { applyPreviewVariablePlaceholders } from '@/lib/sales/prompts/previewPlaceholders'
import { buildPromptPreviewMeta } from '@/lib/sales/prompts/promptPreviewMeta'
import { resolvePromptForCampaignContact } from '@/lib/sales/prompts/promptResolver'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import { SALES_INDUSTRY_LABELS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_LABELS } from '@/lib/sales/constants/productLineSlugs'
import { SALES_PROMPT_USE_CASE_LABELS } from '@/lib/sales/constants/useCaseSlugs'
import type { PromptRenderVariables } from '@/lib/sales/prompts/promptRenderVariables.types'

export type ComposePromptBundleInput = {
  campaign: SalesCampaign
  contact: SalesContact
  business: SalesBusiness
  useCaseSlug?: SalesPromptUseCaseSlug
  /** When true, blank variables become preview placeholders (not used in generation). */
  previewMode?: boolean
}

function withPreviewMeta(
  assembled: ReturnType<typeof assemblePromptFromLibrary>,
  productSlug: string,
  industrySlug: string,
  useCaseSlug: string,
  resolutionPath: string[],
) {
  const meta = buildPromptPreviewMeta({
    promptName: assembled.promptName,
    promptVersion: assembled.promptVersion,
    promptLibraryId: assembled.promptLibraryId,
    promptDescription: assembled.promptDescription,
    productSlug,
    industrySlug,
    useCaseSlug,
    resolutionPath,
  })
  return {
    ...assembled,
    product_slug: productSlug,
    industry_slug: industrySlug,
    use_case_slug: useCaseSlug,
    resolution_path: resolutionPath,
    meta,
  }
}

/** Resolve library prompt + render variables + assemble (no LLM call). */
export async function composePromptBundle(
  supabase: SupabaseClient,
  input: ComposePromptBundleInput,
) {
  const [campaignType, offerType, resolved] = await Promise.all([
    getSalesCampaignTypeById(supabase, input.campaign.campaign_type_id),
    getSalesOfferTypeById(supabase, input.campaign.offer_type_id),
    resolvePromptForCampaignContact(supabase, {
      campaign: input.campaign,
      business: input.business,
      useCaseSlug: input.useCaseSlug,
    }),
  ])

  let variables = buildPromptRenderVariables({
    campaign: input.campaign,
    contact: input.contact,
    business: input.business,
    campaignTypeName: campaignType?.name ?? 'Unknown',
    offerTypeName: offerType?.name ?? 'Unknown',
    productSlug: resolved.productSlug,
    industrySlug: resolved.industrySlug,
    useCaseSlug: resolved.useCaseSlug,
  })

  if (input.previewMode) {
    variables = applyPreviewVariablePlaceholders(variables)
  }

  const assembled = assemblePromptFromLibrary(resolved.prompt, variables)

  return withPreviewMeta(
    assembled,
    resolved.productSlug,
    resolved.industrySlug,
    resolved.useCaseSlug,
    resolved.resolutionPath,
  )
}

/** Assemble a specific library row with sample preview variables (no campaign resolution). */
export function composePromptBundleFromLibraryRow(
  prompt: SalesAiPrompt,
  resolutionPath: string[] = [`direct:library_id`, `id:${prompt.id}`],
) {
  const variables: PromptRenderVariables = applyPreviewVariablePlaceholders({
    company_name: '',
    suburb: '',
    postcode: '',
    category: '',
    industry: SALES_INDUSTRY_LABELS[prompt.industry_slug],
    contact_email: '',
    contact_type: '',
    campaign_name: '',
    product_line: SALES_PRODUCT_LINE_LABELS[prompt.product_slug],
    offer_type: '',
    website: '',
    use_case: SALES_PROMPT_USE_CASE_LABELS[prompt.use_case_slug],
  })

  const assembled = assemblePromptFromLibrary(prompt, variables)
  return withPreviewMeta(
    assembled,
    prompt.product_slug,
    prompt.industry_slug,
    prompt.use_case_slug,
    resolutionPath,
  )
}

export type PromptPreviewFoundationResult = Awaited<ReturnType<typeof composePromptBundle>>
