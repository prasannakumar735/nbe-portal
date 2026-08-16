import type { SalesAiPromptDefinition } from '@/lib/sales/types/aiPrompt.types'
import { validateSalesAiPromptForActivation } from '@/lib/sales/prompts/promptValidation'

const REQUIRED_SYSTEM_MARKERS = [
  '## Product overview',
  '## Industry context',
  '## Typical objections',
  '## Technical accuracy',
  '## Personalisation variables',
] as const

const UNSUPPORTED_CLAIM_PATTERNS: RegExp[] = [
  /\bguaranteed\s+roi\b/i,
  /\bguaranteed\s+savings\b/i,
  /\bsave\s+\d+\s*%/i,
  /\breduce\s+(?:costs?|energy)\s+by\s+\d+/i,
  /\bpayback\s+in\s+\d+/i,
  /\b\d+\s*%\s+(?:roi|savings)\b/i,
]

export type PromptSeedContentValidationResult = {
  ok: boolean
  errors: string[]
}

function extensionText(definition: SalesAiPromptDefinition): string {
  return definition.system_prompt_extension?.trim() ?? ''
}

/** Phase 8.7 content checks (activation + library completeness). */
export function validateSalesAiPromptSeedContent(
  definition: SalesAiPromptDefinition,
): PromptSeedContentValidationResult {
  const errors: string[] = []

  const activation = validateSalesAiPromptForActivation(definition)
  if (!activation.ok) {
    errors.push(...activation.errors)
  }

  const ext = extensionText(definition)
  if (!ext) {
    errors.push('Product overview and related sections require system_prompt_extension.')
  } else {
    for (const marker of REQUIRED_SYSTEM_MARKERS) {
      if (!ext.includes(marker)) {
        errors.push(`Missing section in system_prompt_extension: ${marker}`)
      }
    }
  }

  if (!definition.target_audience.length) {
    errors.push('Target audience must include at least one entry.')
  }

  const operational = definition.business_pain_points.filter((p) =>
    p.toLowerCase().includes('operational:'),
  )
  if (operational.length < 2) {
    errors.push('Operational challenges: include at least two Operational: pain points.')
  }

  const blob = [
    definition.value_proposition,
    definition.cta,
    definition.subject_line_guidance,
    ext,
    ...definition.business_pain_points,
  ].join('\n')

  for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(blob)) {
      errors.push(`Unsupported claim pattern detected: ${pattern}`)
    }
  }

  if (definition.word_limit < 120 || definition.word_limit > 220) {
    errors.push('Word limit should align with NBE target (120–180; max 220).')
  }

  return { ok: errors.length === 0, errors }
}
