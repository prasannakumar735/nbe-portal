import type { PromptRenderVariables } from '@/lib/sales/prompts/promptRenderVariables.types'

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export function renderPromptTemplate(
  template: string,
  variables: PromptRenderVariables,
): string {
  return template.replace(VARIABLE_PATTERN, (_, key: string) => {
    const value = variables[key as keyof PromptRenderVariables]
    return value != null ? String(value) : ''
  })
}
