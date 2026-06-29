import type { SalesEmailTemplateTone } from '@/lib/sales/constants/emailTemplate.constants'

export type SalesEmailTemplatePromptConfig = {
  objective: string
  pain_points: string[]
  cta: string
  tone: SalesEmailTemplateTone
  target_roles: string[]
  avoid: string[]
}

export const EMPTY_EMAIL_TEMPLATE_PROMPT_CONFIG: SalesEmailTemplatePromptConfig = {
  objective: '',
  pain_points: [],
  cta: '',
  tone: 'professional',
  target_roles: [],
  avoid: ['spam language', 'aggressive selling'],
}

export function parsePromptConfigFromDb(raw: unknown): SalesEmailTemplatePromptConfig {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_EMAIL_TEMPLATE_PROMPT_CONFIG }
  }
  const o = raw as Record<string, unknown>
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []

  const toneRaw = String(o.tone ?? 'professional')
  const tone = (
    ['professional', 'friendly', 'technical', 'sales-focused', 'urgent'] as const
  ).includes(toneRaw as SalesEmailTemplateTone)
    ? (toneRaw as SalesEmailTemplateTone)
    : 'professional'

  return {
    objective: String(o.objective ?? '').trim(),
    pain_points: asStringArray(o.pain_points),
    cta: String(o.cta ?? '').trim(),
    tone,
    target_roles: asStringArray(o.target_roles),
    avoid: asStringArray(o.avoid).length
      ? asStringArray(o.avoid)
      : [...EMPTY_EMAIL_TEMPLATE_PROMPT_CONFIG.avoid],
  }
}
