import type { SalesAiPrompt, SalesAiPromptDefinition } from '@/lib/sales/types/aiPrompt.types'
import {
  SALES_AI_DEFAULT_OUTPUT_FORMAT,
  formatGlobalWritingRulesBlock,
} from '@/lib/sales/prompts/globalWritingRules'
import type { PromptRenderVariables } from '@/lib/sales/prompts/promptRenderVariables.types'
import { renderPromptTemplate } from '@/lib/sales/prompts/variableRendering'

function formatList(items: string[], maxItems = 8): string {
  const slice = items.slice(0, maxItems)
  const lines = slice.length > 0 ? slice.map((item) => `- ${item}`).join('\n') : '- (none specified)'
  if (items.length > maxItems) {
    return `${lines}\n- (and ${items.length - maxItems} more)`
  }
  return lines
}

function assembleUserPromptFromComponents(
  definition: SalesAiPromptDefinition,
  variables: PromptRenderVariables,
): string {
  return [
    'Write a single personalised B2B sales outreach email using the following brief.',
    '',
    '## Context',
    `Company: ${variables.company_name}`,
    `Location: ${[variables.suburb, variables.postcode].filter(Boolean).join(', ') || variables.postcode}`,
    `Industry/category: ${variables.category}`,
    `Prompt industry focus: ${variables.industry}`,
    `Product line: ${variables.product_line}`,
    `Use case: ${variables.use_case}`,
    `Campaign: ${variables.campaign_name}`,
    `Offer: ${variables.offer_type}`,
    `Contact: ${variables.contact_email} (${variables.contact_type})`,
    variables.website ? `Website: ${variables.website}` : null,
    '',
    '## Writing brief',
    `Writing style: ${definition.writing_style}`,
    `Tone: ${definition.tone}`,
    '',
    '## Target audience',
    formatList(definition.target_audience),
    '',
    '## Business pain points to address',
    formatList(definition.business_pain_points),
    '',
    '## Value proposition',
    definition.value_proposition,
    '',
    '## Call to action',
    definition.cta,
    '',
    '## Subject line guidance',
    definition.subject_line_guidance,
    '',
    '## Avoid',
    formatList(definition.avoid),
    '',
    formatGlobalWritingRulesBlock(),
    '',
    '## Output',
    `Keep the email body under ${definition.word_limit} words.`,
    'Return JSON only: {"subject":"...","body":"..."}.',
  ]
    .filter((line): line is string => line != null)
    .join('\n')
}

export type AssembledPromptBundle = {
  systemPrompt: string
  userPrompt: string
  promptName: string
  promptVersion: number
  promptLibraryId: string
  promptDescription: string | null
  variables: PromptRenderVariables
}

/** Assemble system + user prompts from structured library components and global rules. */
export function assemblePromptFromLibrary(
  prompt: SalesAiPrompt,
  variables: PromptRenderVariables,
): AssembledPromptBundle {
  const { definition } = prompt

  const systemParts = [
    'You write B2B industrial sales outreach emails for Australian decision-makers.',
    'Follow the user prompt exactly.',
    definition.system_prompt_extension,
    formatGlobalWritingRulesBlock(),
    SALES_AI_DEFAULT_OUTPUT_FORMAT,
  ].filter(Boolean)

  const userPrompt = definition.user_prompt_template?.trim()
    ? renderPromptTemplate(definition.user_prompt_template, variables)
    : assembleUserPromptFromComponents(definition, variables)

  return {
    systemPrompt: systemParts.join('\n\n'),
    userPrompt,
    promptName: prompt.prompt_name,
    promptVersion: prompt.version,
    promptLibraryId: prompt.id,
    promptDescription: prompt.description,
    variables,
  }
}

/** @alias assemblePromptFromLibrary */
export const assembleGenerationPrompts = assemblePromptFromLibrary

export type AssembledGenerationPrompts = AssembledPromptBundle

export type PromptPreviewAssembly = AssembledPromptBundle & {
  product_slug: string
  industry_slug: string
  use_case_slug: string
  resolution_path: string[]
}
