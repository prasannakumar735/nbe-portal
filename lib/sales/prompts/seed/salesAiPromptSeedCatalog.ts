import { SALES_INDUSTRY_SLUGS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_SLUGS } from '@/lib/sales/constants/productLineSlugs'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import type { SalesAiPromptDefinition } from '@/lib/sales/types/aiPrompt.types'
import { buildSalesAiPromptSeedDefinition } from '@/lib/sales/prompts/seed/buildSalesAiPromptSeedDefinition'

export const SALES_AI_PROMPT_SEED_VERSION = 2

export type SalesAiPromptSeedSlot = {
  product_slug: SalesProductLineSlug
  industry_slug: SalesIndustrySlug
  use_case_slug: 'initial_outreach'
  version: number
  definition: SalesAiPromptDefinition
}

function buildCatalog(): SalesAiPromptSeedSlot[] {
  const slots: SalesAiPromptSeedSlot[] = []
  for (const product_slug of SALES_PRODUCT_LINE_SLUGS) {
    for (const industry_slug of SALES_INDUSTRY_SLUGS) {
      slots.push({
        product_slug,
        industry_slug,
        use_case_slug: 'initial_outreach',
        version: SALES_AI_PROMPT_SEED_VERSION,
        definition: buildSalesAiPromptSeedDefinition(product_slug, industry_slug),
      })
    }
  }
  return slots
}

/** 4 products × 7 industries × initial_outreach (28 rows). */
export const SALES_AI_PROMPT_SEED_CATALOG: SalesAiPromptSeedSlot[] = buildCatalog()
