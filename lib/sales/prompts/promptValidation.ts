import type { SalesAiPromptDefinition } from '@/lib/sales/types/aiPrompt.types'
import { PROMPT_RENDER_VARIABLE_KEYS } from '@/lib/sales/prompts/variableRendering'

export type PromptActivationValidationResult = {
  ok: boolean
  errors: string[]
}

function isBlank(value: string | undefined | null): boolean {
  return value == null || String(value).trim() === ''
}

function hasNonEmptyList(items: string[] | undefined): boolean {
  return Array.isArray(items) && items.some((item) => !isBlank(item))
}

/** Required sections before a prompt may become Active. */
export function validateSalesAiPromptForActivation(
  definition: SalesAiPromptDefinition,
): PromptActivationValidationResult {
  const errors: string[] = []

  if (isBlank(definition.tone)) {
    errors.push('Tone is required.')
  }
  if (!hasNonEmptyList(definition.business_pain_points)) {
    errors.push('Pain Points must include at least one entry.')
  }
  if (isBlank(definition.value_proposition)) {
    errors.push('Value Proposition is required.')
  }
  if (isBlank(definition.cta)) {
    errors.push('CTA is required.')
  }
  if (isBlank(definition.subject_line_guidance)) {
    errors.push('Subject Guidance is required.')
  }

  const template = definition.user_prompt_template?.trim()
  if (template) {
    const used = new Set<string>()
    for (const match of template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
      if (match[1]) used.add(match[1])
    }
    const known = PROMPT_RENDER_VARIABLE_KEYS.filter((key) => used.has(key))
    if (known.length === 0) {
      errors.push(
        'Variables: custom user prompt template must include at least one known {{variable}} (e.g. {{company_name}}).',
      )
    }
  }
  // Structured assembly always injects render variables; no extra check when template is omitted.

  return { ok: errors.length === 0, errors }
}

export function formatPromptValidationErrorMessage(errors: string[]): string {
  return `Prompt is incomplete and cannot be activated:\n- ${errors.join('\n- ')}`
}
