import type { SalesAiPrompt, SalesAiPromptDefinition } from '@/lib/sales/types/aiPrompt.types'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import {
  NBE_EMAIL_WORD_ABSOLUTE_MAX,
  SALES_AI_DEFAULT_OUTPUT_FORMAT,
  formatNbeFrameworkSystemBrief,
  formatNbeFrameworkUserSections,
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
  slot: { productSlug: SalesProductLineSlug; industrySlug: SalesIndustrySlug },
): string {
  const wordCap = Math.min(definition.word_limit, NBE_EMAIL_WORD_ABSOLUTE_MAX)
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
    '## Personalisation (required)',
    `- Write to this business by name: ${variables.company_name}.`,
    '- Do not open with contacting manufacturing facilities, companies, or businesses in a suburb/postcode/area.',
    `- Align practical value with prompt industry focus (${variables.industry}) and category (${variables.category}).`,
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
    formatNbeFrameworkUserSections({
      productSlug: slot.productSlug,
      industrySlug: slot.industrySlug,
    }),
    '',
    '## Output',
    `Keep the email body under ${wordCap} words (NBE target 120–180).`,
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

  const frameworkTail = [
    '',
    formatNbeFrameworkUserSections({
      productSlug: prompt.product_slug,
      industrySlug: prompt.industry_slug,
    }),
    '',
    '## Output',
    `Keep the email body under ${Math.min(definition.word_limit, NBE_EMAIL_WORD_ABSOLUTE_MAX)} words.`,
    'Return JSON only: {"subject":"...","body":"..."}.',
  ].join('\n')

  const systemParts = [
    formatNbeFrameworkSystemBrief(),
    definition.system_prompt_extension,
    SALES_AI_DEFAULT_OUTPUT_FORMAT,
  ].filter(Boolean)

  const userPrompt = definition.user_prompt_template?.trim()
    ? `${renderPromptTemplate(definition.user_prompt_template, variables)}${frameworkTail}`
    : assembleUserPromptFromComponents(definition, variables, {
        productSlug: prompt.product_slug,
        industrySlug: prompt.industry_slug,
      })

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
