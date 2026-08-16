import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import { SALES_INDUSTRY_LABELS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_LABELS } from '@/lib/sales/constants/productLineSlugs'
import {
  EMPTY_SALES_AI_PROMPT_DEFINITION,
  type SalesAiPromptDefinition,
} from '@/lib/sales/types/aiPrompt.types'
import { INDUSTRY_SEED_OVERLAY } from '@/lib/sales/prompts/seed/industrySeedContent'
import { PRODUCT_SEED_CONTENT } from '@/lib/sales/prompts/seed/productSeedContent'

const SEED_EXTRA_AVOID = [
  'Guaranteed ROI',
  'Guaranteed savings',
  'Save X%',
  'Payback in',
  'Cheapest',
  'World-class',
  'Revolutionary',
] as const

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const key = item.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

function formatSystemExtension(input: {
  productLabel: string
  industryLabel: string
  overview: string
  typicalObjections: string[]
  technicalAccuracyNotes: string[]
  valueEmphasis: string
}): string {
  return [
    `## Product overview (${input.productLabel})`,
    input.overview,
    '',
    `## Industry context (${input.industryLabel})`,
    input.valueEmphasis,
    '',
    '## Typical objections (respond consultatively; do not argue or oversell)',
    ...input.typicalObjections.map((o) => `- ${o}`),
    '',
    '## Technical accuracy (this prompt)',
    ...input.technicalAccuracyNotes.map((n) => `- ${n}`),
    '',
    '## Personalisation variables',
    'Use only context supplied in the user prompt: company_name, suburb, postcode, category, industry, product_line, campaign_name, offer_type, contact_email, contact_type, website, use_case. Do not invent site facts.',
  ].join('\n')
}

/** Build a Phase 8.7 library definition for product × industry (initial outreach). */
export function buildSalesAiPromptSeedDefinition(
  productSlug: SalesProductLineSlug,
  industrySlug: SalesIndustrySlug,
): SalesAiPromptDefinition {
  const product = PRODUCT_SEED_CONTENT[productSlug]
  const industry = INDUSTRY_SEED_OVERLAY[industrySlug]
  const productLabel = SALES_PRODUCT_LINE_LABELS[productSlug]
  const industryLabel = SALES_INDUSTRY_LABELS[industrySlug]

  const painPoints = uniqueStrings([
    ...product.customerPainPoints,
    ...industry.painPointAdditions,
    ...product.operationalChallenges.map((c) => `Operational: ${c}`),
    ...industry.operationalChallengeAdditions.map((c) => `Operational: ${c}`),
  ])

  const subjectGuidance = [
    product.subjectLineGuidance,
    `Angle for ${industryLabel}: ${industry.subjectAngle}.`,
  ].join(' ')

  const valueProposition = [product.valueProposition, industry.valueEmphasis].join(' ')

  return {
    ...EMPTY_SALES_AI_PROMPT_DEFINITION,
    writing_style: 'consultative',
    tone: 'professional, helpful, respectful; Australian English',
    target_audience: uniqueStrings([...product.targetAudience, ...industry.audienceAdditions]),
    business_pain_points: painPoints,
    value_proposition: valueProposition,
    cta: product.cta,
    subject_line_guidance: subjectGuidance,
    word_limit: 180,
    avoid: uniqueStrings([...EMPTY_SALES_AI_PROMPT_DEFINITION.avoid, ...SEED_EXTRA_AVOID]),
    system_prompt_extension: formatSystemExtension({
      productLabel,
      industryLabel,
      overview: product.overview,
      typicalObjections: product.typicalObjections,
      technicalAccuracyNotes: product.technicalAccuracyNotes,
      valueEmphasis: industry.valueEmphasis,
    }),
  }
}
