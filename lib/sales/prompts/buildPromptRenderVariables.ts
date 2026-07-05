import type { SalesBusiness } from '@/lib/sales/types/business.types'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import { SALES_INDUSTRY_LABELS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_LABELS } from '@/lib/sales/constants/productLineSlugs'
import { SALES_PROMPT_USE_CASE_LABELS } from '@/lib/sales/constants/useCaseSlugs'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'
import type { PromptRenderVariables } from '@/lib/sales/prompts/promptRenderVariables.types'

export function buildPromptRenderVariables(input: {
  campaign: SalesCampaign
  contact: SalesContact
  business: SalesBusiness
  campaignTypeName: string
  offerTypeName: string
  productSlug: SalesProductLineSlug
  industrySlug: SalesIndustrySlug
  useCaseSlug: SalesPromptUseCaseSlug
}): PromptRenderVariables {
  return {
    company_name: input.business.company_name,
    suburb: input.business.suburb ?? '',
    postcode: input.business.postcode ?? '',
    category: input.business.category ?? 'unknown',
    industry: SALES_INDUSTRY_LABELS[input.industrySlug],
    contact_email: input.contact.email ?? '',
    contact_type: input.contact.contact_type,
    campaign_name: input.campaign.name,
    product_line: SALES_PRODUCT_LINE_LABELS[input.productSlug],
    offer_type: input.offerTypeName,
    website: input.business.website?.trim() ?? '',
    use_case: SALES_PROMPT_USE_CASE_LABELS[input.useCaseSlug],
  }
}
