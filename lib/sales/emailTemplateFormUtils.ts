import type { SalesEmailTemplatePromptConfig } from '@/lib/sales/types/emailTemplatePromptConfig'

export function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function listToLines(items: string[]): string {
  return items.join('\n')
}

export type EmailTemplatePromptFormFields = {
  objective: string
  painPointsText: string
  cta: string
  tone: SalesEmailTemplatePromptConfig['tone']
  targetRolesText: string
  avoidText: string
}

export function promptConfigToFormFields(
  config: SalesEmailTemplatePromptConfig,
): EmailTemplatePromptFormFields {
  return {
    objective: config.objective,
    painPointsText: listToLines(config.pain_points),
    cta: config.cta,
    tone: config.tone,
    targetRolesText: listToLines(config.target_roles),
    avoidText: listToLines(config.avoid),
  }
}

export function formFieldsToPromptConfig(
  fields: EmailTemplatePromptFormFields,
): SalesEmailTemplatePromptConfig {
  return {
    objective: fields.objective.trim(),
    pain_points: linesToList(fields.painPointsText),
    cta: fields.cta.trim(),
    tone: fields.tone,
    target_roles: linesToList(fields.targetRolesText),
    avoid: linesToList(fields.avoidText),
  }
}
