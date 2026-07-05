import type { PromptRenderVariables } from '@/lib/sales/prompts/promptRenderVariables.types'

/** Supported {{variable}} keys for optional user_prompt_template and preview UI. */
export const PROMPT_RENDER_VARIABLE_KEYS = [
  'company_name',
  'suburb',
  'postcode',
  'category',
  'industry',
  'contact_email',
  'contact_type',
  'campaign_name',
  'product_line',
  'offer_type',
  'website',
  'use_case',
] as const satisfies readonly (keyof PromptRenderVariables)[]

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** Replace {{key}} placeholders; unknown keys become empty strings. */
export function renderPromptTemplate(
  template: string,
  variables: PromptRenderVariables,
): string {
  return template.replace(VARIABLE_PATTERN, (_, key: string) => {
    const value = variables[key as keyof PromptRenderVariables]
    return value != null ? String(value) : ''
  })
}

/** List unresolved {{tokens}} left after rendering (for preview QA). */
export function findUnresolvedPromptVariables(template: string): string[] {
  const found = new Set<string>()
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const key = match[1]
    if (key) found.add(key)
  }
  return [...found]
}
