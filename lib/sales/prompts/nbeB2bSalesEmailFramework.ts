/**
 * NBE Australia — professional B2B industrial sales email methodology.
 * Applied at prompt assembly time for every library-backed generation (not stored per row).
 */

import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'

export const NBE_EMAIL_WORD_TARGET_MIN = 120
export const NBE_EMAIL_WORD_TARGET_MAX = 180
export const NBE_EMAIL_WORD_ABSOLUTE_MAX = 220
export const NBE_SUBJECT_MAX_WORDS = 8

/** Phrases the model must not use (Australian B2B consultative standard). */
export const NBE_BANNED_PHRASES: readonly string[] = [
  "Hope you're doing well",
  'I hope this email finds you well',
  'Just checking in',
  'Industry-leading',
  'Best-in-class',
  'Revolutionary',
  'Amazing',
  'Limited-time offer',
  'Act now',
  "Don't miss out",
  'Exclusive offer',
  'World-class',
  'Cheap',
  'Lowest price',
  'SALE',
  'SPECIAL OFFER',
  'LIMITED TIME',
  'FREE TODAY',
  'I wanted to reach out',
]

export const NBE_STANDARD_CTA_OFFERS: readonly string[] = [
  'Free site inspection',
  'No-obligation site assessment',
  'Product recommendation',
  'Quotation',
]

export const NBE_DEFAULT_CTA_TEMPLATE =
  "If you'd like, we would be happy to arrange a no-obligation site assessment, provide a product recommendation, or prepare a quotation based on your facility's operational requirements."

/** Do not state specific savings/ROI unless verified customer data or explicit NBE copy is provided. */
export const NBE_UNSUPPORTED_CLAIM_EXAMPLES: readonly string[] = [
  'Save 50% on energy',
  'Reduce costs by 30%',
  'Guaranteed ROI',
  'Guaranteed savings',
  'Will save you $X',
  'Proven to cut costs by X%',
]

export const NBE_QUALIFIED_BENEFIT_LANGUAGE: readonly string[] = [
  'Can help reduce…',
  'May improve…',
  'Often assists with…',
  'Designed to…',
  'Helps support…',
]

export const NBE_TECHNICAL_ACCURACY_RULES: readonly string[] = [
  'Do not claim measurable savings, percentages, payback periods, or ROI unless supported by verified customer data or text explicitly supplied by NBE Australia in this prompt.',
  'Do not guarantee outcomes.',
  'Prefer qualified benefit language when describing operational or cost impact.',
]

export const NBE_WRITING_STYLE_RULES: readonly string[] = [
  'Australian English spelling and conventions.',
  'Professional, consultative, helpful, respectful; technical where appropriate; conversational but not casual.',
  'Educate rather than sell aggressively; never sound like spam.',
  'No exaggerated marketing language, fake urgency, multiple exclamation marks, emojis, or excessive bold.',
  'One clear message and exactly one low-pressure CTA.',
  `Body length: target ${NBE_EMAIL_WORD_TARGET_MIN}–${NBE_EMAIL_WORD_TARGET_MAX} words; never exceed ${NBE_EMAIL_WORD_ABSOLUTE_MAX} words.`,
  ...NBE_TECHNICAL_ACCURACY_RULES,
]

export const NBE_EMAIL_STRUCTURE: readonly { title: string; guidance: string }[] = [
  {
    title: '1. Personalised observation',
    guidance:
      'Open with something relevant to warehouse operations, loading docks, manufacturing, distribution, cold storage, food production, or logistics. Do not invent facts. Use phrasing such as "Based on your operations…", "It appears your facility…", or "Many businesses operating facilities like yours…".',
  },
  {
    title: '2. Customer problem',
    guidance:
      'Describe operational challenges before mentioning products. Focus on problems the prospect likely faces in their context.',
  },
  {
    title: '3. Solution',
    guidance:
      'Introduce NBE naturally (e.g. "NBE Australia helps businesses…"). Do not lead with "We sell…". Explain how the solution addresses the problem.',
  },
  {
    title: '4. Business benefits',
    guidance:
      'Emphasise outcomes (workflow, energy, operating costs, temperature, safety, productivity) using qualified language. Do not state specific savings percentages or guaranteed ROI unless verified NBE data is provided in this prompt.',
  },
  {
    title: '5. Low-pressure CTA',
    guidance:
      'Use exactly one CTA. Prefer practical, site-focused offers (free site inspection, no-obligation site assessment, product recommendation, quotation). Do not pressure or demand an immediate meeting.',
  },
]

export const NBE_SUBJECT_LINE_RULES: readonly string[] = [
  `One concise subject line; maximum ${NBE_SUBJECT_MAX_WORDS} words.`,
  'Do not use unnecessary capitals or hype (no SALE, SPECIAL OFFER, LIMITED TIME, FREE TODAY).',
  'Good style: specific and operational (e.g. "Reducing energy loss in warehouse doorways").',
]

export const NBE_PERSONALISATION_RULES: readonly string[] = [
  'Use only provided data: company name, industry/category, location, website, product line, campaign context.',
  'Never invent employee counts, warehouse size, revenue, equipment, or customers.',
  'Never hallucinate; if detail is missing, stay general.',
]

export const NBE_SIGNATURE_GUIDANCE = [
  'Close professionally, e.g. Kind regards,',
  '[Salesperson name if known, otherwise omit personal name]',
  'NBE Australia',
  'Industrial Door Solutions',
  'Include phone and website only if provided in context; keep the signature simple.',
].join(' ')

const PRODUCT_GUIDANCE: Record<SalesProductLineSlug, { problems: string[]; focus: string[] }> = {
  pvc_strip_curtains: {
    problems: [
      'temperature loss',
      'dust and insects',
      'forklift and pedestrian traffic',
      'noise',
      'energy costs',
    ],
    focus: [
      'energy efficiency',
      'temperature retention',
      'hygiene',
      'dust reduction',
      'forklift and pedestrian access',
    ],
  },
  rapid_roller_doors: {
    problems: [
      'traffic efficiency',
      'door downtime',
      'safety',
      'energy loss',
      'maintenance burden',
    ],
    focus: ['speed', 'safety', 'reliability', 'insulation', 'productivity'],
  },
  preventive_maintenance: {
    problems: [
      'unplanned downtime',
      'unexpected repair costs',
      'equipment reliability',
      'compliance',
      'asset life',
    ],
    focus: [
      'planned servicing',
      'reduced downtime',
      'equipment lifespan',
      'emergency breakdown prevention',
    ],
  },
  dock_doors: {
    problems: [
      'loading dock efficiency',
      'seal and insulation gaps',
      'traffic flow',
      'safety at docks',
      'energy loss at doorways',
    ],
    focus: [
      'loading efficiency',
      'dock sealing',
      'workflow',
      'safety',
      'temperature control at docks',
    ],
  },
}

const INDUSTRY_GUIDANCE: Record<SalesIndustrySlug, string[]> = {
  general: ['operational efficiency', 'safety', 'cost control', 'reliable site access'],
  food_processing: ['hygiene', 'contamination control', 'temperature', 'compliance'],
  cold_storage: ['cold air retention', 'compressor efficiency', 'operating costs'],
  warehousing: ['forklift traffic', 'loading docks', 'workflow'],
  manufacturing: ['production flow', 'dust', 'noise', 'safety'],
  logistics: ['loading efficiency', 'dispatch', 'turnaround time'],
  pharmaceutical: ['hygiene', 'compliance', 'controlled environments', 'audit readiness'],
}

export const NBE_FINAL_VALIDATION_CHECKLIST: readonly string[] = [
  'Professional Australian English',
  'No hype or fake urgency',
  'No invented facts or unverified savings claims',
  'Exactly one CTA',
  `Under ${NBE_EMAIL_WORD_TARGET_MAX} words (hard max ${NBE_EMAIL_WORD_ABSOLUTE_MAX})`,
  'Business-focused: problem first, solution second, benefits third',
  'Professional closing',
  'If any rule is violated, rewrite before returning JSON',
]

export function formatNbeCtaGuidanceBlock(): string {
  return [
    '## Call to action (standard NBE offers)',
    'Use one low-pressure, site-focused CTA drawn from:',
    ...NBE_STANDARD_CTA_OFFERS.map((o) => `- ${o}`),
    `Example phrasing: ${NBE_DEFAULT_CTA_TEMPLATE}`,
  ].join('\n')
}

export function formatNbeTechnicalAccuracyBlock(): string {
  return [
    '## Technical accuracy',
    ...NBE_TECHNICAL_ACCURACY_RULES.map((r) => `- ${r}`),
    '',
    'Do not use unsupported claims such as:',
    ...NBE_UNSUPPORTED_CLAIM_EXAMPLES.map((p) => `- ${p}`),
    '',
    'Prefer language such as:',
    ...NBE_QUALIFIED_BENEFIT_LANGUAGE.map((p) => `- ${p}`),
  ].join('\n')
}

export function formatNbeBannedPhrasesBlock(): string {
  return ['## Never use', ...NBE_BANNED_PHRASES.map((p) => `- ${p}`)].join('\n')
}

export function formatNbeEmailStructureBlock(): string {
  return [
    '## NBE email structure (follow in order)',
    ...NBE_EMAIL_STRUCTURE.map((s) => `### ${s.title}\n${s.guidance}`),
  ].join('\n\n')
}

export function formatNbeSubjectRulesBlock(): string {
  return ['## Subject line rules', ...NBE_SUBJECT_LINE_RULES.map((r) => `- ${r}`)].join('\n')
}

export function formatNbePersonalisationBlock(): string {
  return ['## Personalisation', ...NBE_PERSONALISATION_RULES.map((r) => `- ${r}`)].join('\n')
}

export function formatNbeProductGuidance(productSlug: SalesProductLineSlug): string {
  const g = PRODUCT_GUIDANCE[productSlug]
  return [
    '## Product focus (NBE methodology)',
    'Typical problems:',
    ...g.problems.map((p) => `- ${p}`),
    'Emphasise:',
    ...g.focus.map((p) => `- ${p}`),
  ].join('\n')
}

export function formatNbeIndustryGuidance(industrySlug: SalesIndustrySlug): string {
  const focus = INDUSTRY_GUIDANCE[industrySlug] ?? INDUSTRY_GUIDANCE.general
  return [
    '## Industry focus (NBE methodology)',
    ...focus.map((p) => `- ${p}`),
  ].join('\n')
}

export function formatNbeFinalValidationBlock(): string {
  return [
    '## Final validation (before returning JSON)',
    ...NBE_FINAL_VALIDATION_CHECKLIST.map((c) => `- ${c}`),
  ].join('\n')
}

/** System instruction: role + methodology summary for all NBE sales email generation. */
export function formatNbeFrameworkSystemBrief(): string {
  return [
    'You generate professional, consultative, highly personalised B2B sales emails for NBE Australia.',
    'Each email must feel written by an experienced sales consultant who understands warehouse and industrial operations.',
    'Emails must be unique per business while following the NBE sales methodology in the user prompt.',
    'Do not generate generic marketing copy.',
    ...NBE_WRITING_STYLE_RULES.map((r) => `- ${r}`),
    NBE_SIGNATURE_GUIDANCE,
  ].join('\n')
}

/** User-prompt sections appended after library-specific brief. */
export function formatNbeFrameworkUserSections(input: {
  productSlug: SalesProductLineSlug
  industrySlug: SalesIndustrySlug
}): string {
  return [
    formatNbeEmailStructureBlock(),
    formatNbeProductGuidance(input.productSlug),
    formatNbeIndustryGuidance(input.industrySlug),
    formatNbeSubjectRulesBlock(),
    formatNbeCtaGuidanceBlock(),
    formatNbePersonalisationBlock(),
    formatNbeTechnicalAccuracyBlock(),
    formatNbeBannedPhrasesBlock(),
    formatNbeFinalValidationBlock(),
  ].join('\n\n')
}
