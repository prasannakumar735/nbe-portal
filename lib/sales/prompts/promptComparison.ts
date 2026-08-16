import { SALES_AI_GLOBAL_WRITING_RULES } from '@/lib/sales/prompts/globalWritingRules'
import { PROMPT_RENDER_VARIABLE_KEYS } from '@/lib/sales/prompts/variableRendering'
import type { SalesAiPrompt, SalesAiPromptDefinition } from '@/lib/sales/types/aiPrompt.types'

export type PromptComparisonRow = {
  key: string
  label: string
  left: string
  right: string
  changed: boolean
}

function listText(items: string[]): string {
  return items.length > 0 ? items.map((item) => `• ${item}`).join('\n') : '—'
}

function fieldValue(definition: SalesAiPromptDefinition, key: string): string {
  switch (key) {
    case 'tone':
      return definition.tone?.trim() || '—'
    case 'pain_points':
      return listText(definition.business_pain_points ?? [])
    case 'value_proposition':
      return definition.value_proposition?.trim() || '—'
    case 'cta':
      return definition.cta?.trim() || '—'
    case 'subject_guidance':
      return definition.subject_line_guidance?.trim() || '—'
    case 'word_limit':
      return String(definition.word_limit ?? '—')
    case 'global_rules':
      return listText([...SALES_AI_GLOBAL_WRITING_RULES])
    case 'variables':
      return definition.user_prompt_template?.trim()
        ? `Custom template variables:\n${PROMPT_RENDER_VARIABLE_KEYS.map((k) => `{{${k}}}`).join(', ')}`
        : `Structured assembly variables:\n${PROMPT_RENDER_VARIABLE_KEYS.map((k) => `{{${k}}}`).join(', ')}`
    case 'writing_style':
      return definition.writing_style?.trim() || '—'
    case 'target_audience':
      return listText(definition.target_audience ?? [])
    case 'avoid':
      return listText(definition.avoid ?? [])
    default:
      return '—'
  }
}

export const PROMPT_COMPARISON_FIELDS: { key: string; label: string }[] = [
  { key: 'tone', label: 'Tone' },
  { key: 'pain_points', label: 'Pain Points' },
  { key: 'value_proposition', label: 'Value Proposition' },
  { key: 'cta', label: 'CTA' },
  { key: 'subject_guidance', label: 'Subject Guidance' },
  { key: 'word_limit', label: 'Word Limit' },
  { key: 'global_rules', label: 'Global Rules' },
  { key: 'variables', label: 'Variables' },
  { key: 'writing_style', label: 'Writing Style' },
  { key: 'target_audience', label: 'Target Audience' },
  { key: 'avoid', label: 'Avoid' },
]

export function buildPromptComparisonRows(
  left: SalesAiPrompt,
  right: SalesAiPrompt,
): PromptComparisonRow[] {
  return PROMPT_COMPARISON_FIELDS.map(({ key, label }) => {
    const leftValue = fieldValue(left.definition, key)
    const rightValue = fieldValue(right.definition, key)
    // Global rules are always identical (inherited); still show for clarity.
    const changed = key === 'global_rules' ? false : leftValue !== rightValue
    return { key, label, left: leftValue, right: rightValue, changed }
  })
}
