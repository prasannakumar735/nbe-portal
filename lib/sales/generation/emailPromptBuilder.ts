import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesBusiness } from '@/lib/sales/types/business.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import { composePromptBundle } from '@/lib/sales/prompts/promptPreviewFoundation'
import type { AssembledPromptBundle } from '@/lib/sales/prompts/promptAssembler'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import { getSalesCampaignTypeById } from '@/lib/sales/repositories/salesCampaignTypeRepository'
import { getSalesOfferTypeById } from '@/lib/sales/repositories/salesOfferTypeRepository'
import { getSalesAiPromptById } from '@/lib/sales/repositories/salesAiPromptRepository'
import {
  SALES_EMAIL_TEMPLATE_TONES,
  type SalesEmailTemplateTone,
} from '@/lib/sales/constants/emailTemplate.constants'
import type { SalesEmailTemplatePromptConfigInput } from '@/lib/sales/validators/emailTemplatePromptConfig.validators'
import type { SalesEmailTemplate } from '@/lib/sales/types/emailTemplate.types'

export type EmailGenerationPromptBundle = AssembledPromptBundle & {
  product_slug?: string
  industry_slug?: string
  use_case_slug?: string
  resolution_path?: string[]
}

export type EmailGenerationPromptContext = {
  campaign: SalesCampaign
  contact: SalesContact
  business: SalesBusiness
  campaignTypeName: string
  offerTypeName: string
  template: Pick<SalesEmailTemplate, 'template_name'>
  promptConfig: SalesEmailTemplatePromptConfigInput
}

function coerceTemplateTone(raw: string): SalesEmailTemplateTone {
  const normalized = raw.trim().toLowerCase()
  if ((SALES_EMAIL_TEMPLATE_TONES as readonly string[]).includes(normalized)) {
    return normalized as SalesEmailTemplateTone
  }
  return 'professional'
}

export async function buildEmailGenerationPromptBundle(
  supabase: SupabaseClient,
  input: {
    campaign: SalesCampaign
    contact: SalesContact
    business: SalesBusiness
    useCaseSlug?: SalesPromptUseCaseSlug
  },
): Promise<EmailGenerationPromptBundle> {
  return composePromptBundle(supabase, input)
}

/** Follow-up prompts use legacy template-shaped context; map from resolved library row. */
export async function loadEmailGenerationPromptContext(
  supabase: SupabaseClient,
  input: {
    campaign: SalesCampaign
    contact: SalesContact
    business: SalesBusiness
    useCaseSlug?: SalesPromptUseCaseSlug
  },
): Promise<EmailGenerationPromptContext> {
  const [bundle, campaignType, offerType] = await Promise.all([
    buildEmailGenerationPromptBundle(supabase, input),
    getSalesCampaignTypeById(supabase, input.campaign.campaign_type_id),
    getSalesOfferTypeById(supabase, input.campaign.offer_type_id),
  ])

  const promptRow = await getSalesAiPromptById(supabase, bundle.promptLibraryId)

  const d = promptRow?.definition

  return {
    campaign: input.campaign,
    contact: input.contact,
    business: input.business,
    campaignTypeName: campaignType?.name ?? 'Unknown',
    offerTypeName: offerType?.name ?? 'Unknown',
    template: {
      template_name: bundle.promptDescription?.trim() || bundle.promptName,
    },
    promptConfig: {
      objective: d?.value_proposition?.trim() || 'Introduce relevant industrial solutions.',
      pain_points: d?.business_pain_points?.length ? d.business_pain_points : ['Operational efficiency'],
      cta: d?.cta?.trim() || 'Suggest a brief call to discuss fit.',
      tone: coerceTemplateTone(d?.tone ?? 'professional'),
      target_roles: d?.target_audience?.length ? d.target_audience : ['Operations manager'],
      avoid: d?.avoid?.length ? d.avoid : ['spam language'],
    },
  }
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
