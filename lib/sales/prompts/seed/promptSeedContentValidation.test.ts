import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SALES_INDUSTRY_SLUGS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_SLUGS } from '@/lib/sales/constants/productLineSlugs'
import { assemblePromptFromLibrary } from '@/lib/sales/prompts/promptAssembler'
import { applyPreviewVariablePlaceholders } from '@/lib/sales/prompts/previewPlaceholders'
import { buildPromptNameKey } from '@/lib/sales/types/aiPrompt.types'
import { formatPromptDescriptionLabel } from '@/lib/sales/prompts/promptLabels'
import { validateSalesAiPromptSeedContent } from '@/lib/sales/prompts/seed/promptSeedContentValidation'
import {
  SALES_AI_PROMPT_SEED_CATALOG,
  SALES_AI_PROMPT_SEED_VERSION,
} from '@/lib/sales/prompts/seed/salesAiPromptSeedCatalog'

describe('Phase 8.7 prompt seed catalog', () => {
  it('contains 4 products × 7 industries', () => {
    assert.equal(SALES_AI_PROMPT_SEED_CATALOG.length, SALES_PRODUCT_LINE_SLUGS.length * SALES_INDUSTRY_SLUGS.length)
    assert.equal(SALES_AI_PROMPT_SEED_VERSION, 2)
  })

  for (const slot of SALES_AI_PROMPT_SEED_CATALOG) {
    const label = formatPromptDescriptionLabel({
      productSlug: slot.product_slug,
      industrySlug: slot.industry_slug,
      useCaseSlug: slot.use_case_slug,
    })

    it(`validates content: ${label}`, () => {
      const result = validateSalesAiPromptSeedContent(slot.definition)
      assert.equal(result.ok, true, result.errors.join('; '))
    })

    it(`assembles preview: ${label}`, () => {
      const promptName = buildPromptNameKey({
        product_slug: slot.product_slug,
        industry_slug: slot.industry_slug,
        use_case_slug: slot.use_case_slug,
      })
      const variables = applyPreviewVariablePlaceholders({
        company_name: '',
        suburb: '',
        postcode: '',
        category: '',
        industry: '',
        contact_email: '',
        contact_type: '',
        campaign_name: '',
        product_line: '',
        offer_type: '',
        website: '',
        use_case: '',
      })
      const assembled = assemblePromptFromLibrary(
        {
          id: '00000000-0000-0000-0000-000000000001',
          prompt_name: promptName,
          version: slot.version,
          product_slug: slot.product_slug,
          industry_slug: slot.industry_slug,
          use_case_slug: slot.use_case_slug,
          campaign_type_id: null,
          definition: slot.definition,
          description: label,
          is_active: true,
          created_by: null,
          created_at: new Date().toISOString(),
        },
        variables,
      )
      assert.ok(assembled.systemPrompt.includes('NBE Australia'))
      assert.ok(assembled.systemPrompt.includes('Product overview'))
      assert.ok(assembled.userPrompt.includes('Unknown Company'))
      assert.ok(assembled.userPrompt.includes('## Business pain points'))
      assert.ok(assembled.userPrompt.includes('Return JSON only'))
    })
  }
})
