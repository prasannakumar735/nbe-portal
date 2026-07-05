export const SALES_PROMPT_USE_CASE_SLUGS = [
  'initial_outreach',
  'follow_up',
  'quote_request',
  'site_assessment',
] as const

export type SalesPromptUseCaseSlug = (typeof SALES_PROMPT_USE_CASE_SLUGS)[number]

export function isSalesPromptUseCaseSlug(value: string): value is SalesPromptUseCaseSlug {
  return (SALES_PROMPT_USE_CASE_SLUGS as readonly string[]).includes(value)
}

export const SALES_PROMPT_USE_CASE_LABELS: Record<SalesPromptUseCaseSlug, string> = {
  initial_outreach: 'Initial outreach',
  follow_up: 'Follow-up',
  quote_request: 'Quote request',
  site_assessment: 'Site assessment',
}

/** Default use case when campaigns do not specify one (Phase 8.5). */
export const DEFAULT_SALES_PROMPT_USE_CASE: SalesPromptUseCaseSlug = 'initial_outreach'
