import type { PromptRenderVariables } from '@/lib/sales/prompts/promptRenderVariables.types'

/** Preview-only fallbacks when campaign/contact/business fields are empty. */
export const PREVIEW_VARIABLE_PLACEHOLDERS: PromptRenderVariables = {
  company_name: 'Unknown Company',
  suburb: 'Unknown Suburb',
  postcode: '0000',
  category: 'Unknown Category',
  industry: 'General',
  contact_email: 'contact@example.com.au',
  contact_type: 'general',
  campaign_name: 'Preview Campaign',
  product_line: 'Unknown Product',
  offer_type: 'Unknown Offer',
  website: 'https://example.com.au',
  use_case: 'Initial outreach',
}

function isBlank(value: string | undefined | null): boolean {
  return value == null || String(value).trim() === ''
}

/** Fill blank render variables for preview UI only (not used in generation). */
export function applyPreviewVariablePlaceholders(
  variables: PromptRenderVariables,
): PromptRenderVariables {
  const out = { ...variables }
  for (const key of Object.keys(PREVIEW_VARIABLE_PLACEHOLDERS) as (keyof PromptRenderVariables)[]) {
    if (isBlank(out[key])) {
      out[key] = PREVIEW_VARIABLE_PLACEHOLDERS[key]
    }
  }
  return out
}
