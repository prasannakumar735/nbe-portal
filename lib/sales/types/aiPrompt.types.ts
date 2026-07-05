import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import type { SalesPromptUseCaseSlug } from '@/lib/sales/constants/useCaseSlugs'

/** Structured components assembled into user/system prompts (not one monolithic blob). */
export type SalesAiPromptDefinition = {
  /** Optional extra system instruction; global rules are always appended. */
  system_prompt_extension?: string
  writing_style: string
  tone: string
  target_audience: string[]
  business_pain_points: string[]
  value_proposition: string
  cta: string
  subject_line_guidance: string
  word_limit: number
  avoid: string[]
  /** Optional Mustache-style {{variables}}; if omitted, components are assembled automatically. */
  user_prompt_template?: string
}

export type SalesAiPrompt = {
  id: string
  prompt_name: string
  version: number
  product_slug: SalesProductLineSlug
  industry_slug: SalesIndustrySlug
  use_case_slug: SalesPromptUseCaseSlug
  campaign_type_id: string | null
  definition: SalesAiPromptDefinition
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export type SalesAiPromptInsert = {
  prompt_name: string
  version: number
  product_slug: SalesProductLineSlug
  industry_slug: SalesIndustrySlug
  use_case_slug: SalesPromptUseCaseSlug
  campaign_type_id?: string | null
  definition: SalesAiPromptDefinition
  description?: string | null
  is_active?: boolean
  created_by?: string | null
}

/** Derived reporting snapshot (not source of truth). Populated from raw campaign events via analytics jobs. */
export type SalesAiPromptMetricsSnapshot = {
  id: string
  prompt_name: string
  prompt_version: number
  reply_rate: number | null
  approval_rate: number | null
  conversion_rate: number | null
  sample_size: number
  computed_at: string
}

export const EMPTY_SALES_AI_PROMPT_DEFINITION: SalesAiPromptDefinition = {
  writing_style: 'consultative',
  tone: 'professional',
  target_audience: [],
  business_pain_points: [],
  value_proposition: '',
  cta: '',
  subject_line_guidance: '',
  word_limit: 180,
  avoid: ['spam language', 'fake urgency', 'exaggerated claims'],
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []
}

export function parseSalesAiPromptDefinitionFromDb(raw: unknown): SalesAiPromptDefinition {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_SALES_AI_PROMPT_DEFINITION }
  }
  const o = raw as Record<string, unknown>
  const wordLimit = Number(o.word_limit ?? EMPTY_SALES_AI_PROMPT_DEFINITION.word_limit)
  return {
    system_prompt_extension:
      o.system_prompt_extension != null ? String(o.system_prompt_extension).trim() : undefined,
    writing_style: String(o.writing_style ?? EMPTY_SALES_AI_PROMPT_DEFINITION.writing_style).trim(),
    tone: String(o.tone ?? EMPTY_SALES_AI_PROMPT_DEFINITION.tone).trim(),
    target_audience: asStringArray(o.target_audience),
    business_pain_points: asStringArray(o.business_pain_points),
    value_proposition: String(o.value_proposition ?? '').trim(),
    cta: String(o.cta ?? '').trim(),
    subject_line_guidance: String(o.subject_line_guidance ?? '').trim(),
    word_limit: Number.isFinite(wordLimit) && wordLimit > 0 ? Math.min(wordLimit, 500) : 180,
    avoid: asStringArray(o.avoid).length
      ? asStringArray(o.avoid)
      : [...EMPTY_SALES_AI_PROMPT_DEFINITION.avoid],
    user_prompt_template:
      o.user_prompt_template != null ? String(o.user_prompt_template).trim() : undefined,
  }
}

/** Stable prompt_name for metrics: product.industry.use_case */
export function buildPromptNameKey(input: {
  product_slug: string
  industry_slug: string
  use_case_slug: string
}): string {
  return `${input.product_slug}.${input.industry_slug}.${input.use_case_slug}`
}
