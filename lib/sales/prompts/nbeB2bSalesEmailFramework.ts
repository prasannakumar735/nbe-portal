/**
 * NBE Australia — AI Writing Manual (canonical B2B customer email methodology).
 * Applied at prompt assembly time for every library-backed generation (not stored per row).
 */

import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'

export const NBE_EMAIL_WORD_TARGET_MIN = 120
export const NBE_EMAIL_WORD_TARGET_MAX = 180
export const NBE_EMAIL_WORD_ABSOLUTE_MAX = 220
export const NBE_SUBJECT_MAX_WORDS = 8

/** Phrases the model must not use (NBE AI Writing Manual). */
export const NBE_BANNED_PHRASES: readonly string[] = [
  "Hope you're doing well",
  'I hope this email finds you well',
  'Just checking in',
  'Industry-leading',
  'Cutting-edge',
  'Best-in-class',
  'Revolutionary',
  'Game-changing',
  'State-of-the-art',
  'Amazing',
  'Unlock efficiency',
  'Transform your business',
  'Maximise productivity',
  'Take your operations to the next level',
  'We are excited',
  'We are thrilled',
  'Limited-time offer',
  'Act now',
  "Don't miss out",
  'Exclusive offer',
  'Exclusive opportunity',
  'Premium solution',
  'World-class',
  'Cheap',
  'Lowest price',
  'SALE',
  'SPECIAL OFFER',
  'LIMITED TIME',
  'FREE TODAY',
  'I wanted to reach out',
  'We are contacting manufacturing facilities',
  'We are contacting facilities in',
  'businesses in your area',
  'facilities in your area',
]

/** Soft assistance CTA style examples — vary wording; do not copy verbatim every time. */
export const NBE_SOFT_CTA_EXAMPLES: readonly string[] = [
  "If you have an upcoming project, we'd be happy to assist.",
  "If you'd like further information, please feel free to contact us.",
  "We'd be pleased to discuss suitable options if required.",
  'Please let us know if we can assist with any future projects.',
]

export const NBE_DEFAULT_CTA_TEMPLATE = NBE_SOFT_CTA_EXAMPLES[0]

/** @deprecated Use NBE_SOFT_CTA_EXAMPLES — kept for UI comparison labels. */
export const NBE_STANDARD_CTA_OFFERS = NBE_SOFT_CTA_EXAMPLES

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
  'May be relevant',
  'Where applicable',
  'Depending on the application',
  'If you have an upcoming requirement',
]

export const NBE_TECHNICAL_ACCURACY_RULES: readonly string[] = [
  'Do not claim measurable savings, percentages, payback periods, or ROI unless supported by verified customer data or text explicitly supplied by NBE Australia in this prompt.',
  'Do not guarantee outcomes.',
  'Prefer qualified benefit language when describing operational or cost impact.',
  'Never invent product specifications, door speeds, certifications, warranty periods, dimensions, or performance claims.',
  'Only use technical information from approved NBE documentation, structured product data, CRM, or other context supplied in this prompt.',
  'If information is unavailable, leave it out — do not estimate or infer.',
]

export const NBE_WRITING_STYLE_RULES: readonly string[] = [
  'Australian English spelling and conventions.',
  'NBE is an engineering company first: professional, calm, friendly, confident, respectful, genuine, helpful, knowledgeable.',
  'Write naturally in plain English; keep sentences clear and concise.',
  'Avoid unnecessary adjectives, filler sentences, and repeating information.',
  'Educate and inform rather than sell; demonstrate expertise; build trust rather than excitement.',
  'Never sound scripted, like a salesperson, like a marketing agency, or AI-generated.',
  'Mention only benefits relevant to the customer industry and likely application.',
  'No exaggerated marketing language, fake urgency, multiple exclamation marks, emojis, or excessive bold.',
  'One clear message and exactly one soft, low-pressure offer of assistance.',
  `Body length: target ${NBE_EMAIL_WORD_TARGET_MIN}–${NBE_EMAIL_WORD_TARGET_MAX} words; never exceed ${NBE_EMAIL_WORD_ABSOLUTE_MAX} words.`,
  ...NBE_TECHNICAL_ACCURACY_RULES,
]

export const NBE_EMAIL_STRUCTURE: readonly { title: string; guidance: string }[] = [
  {
    title: '1. Greeting',
    guidance:
      'Professional and personal. Use the provided company name when greeting (e.g. "Dear [Company name] team,"). Do not invent a contact person name unless supplied in context.',
  },
  {
    title: '2. Reason for contact',
    guidance:
      'One or two sentences explaining why NBE is writing to this specific business (use company name). Do not describe outreach to all businesses, manufacturing facilities, or companies in a suburb, postcode, or region.',
  },
  {
    title: '3. Brief introduction',
    guidance:
      'One or two sentences: NBE Australia supplies and services industrial rapid doors and PVC door systems for commercial and industrial sites. Do not over-promote or list long credentials.',
  },
  {
    title: '4. Relevant product',
    guidance:
      'Introduce only the product or products relevant to the customer industry or likely application.',
  },
  {
    title: '5. Practical value',
    guidance:
      'Explain how the product may assist their operation; focus on operational outcomes, not marketing claims.',
  },
  {
    title: '6. Soft offer of assistance',
    guidance:
      'Invite contact if they have an upcoming project or want further information. Exactly one soft CTA; no pressure, repeated meeting asks, or countdowns.',
  },
  {
    title: '7. Closing',
    guidance: 'Professional, simple, and friendly.',
  },
]

export const NBE_SUBJECT_LINE_RULES: readonly string[] = [
  `One concise subject line; maximum ${NBE_SUBJECT_MAX_WORDS} words.`,
  'Do not use unnecessary capitals or hype (no SALE, SPECIAL OFFER, LIMITED TIME, FREE TODAY).',
  'Good style: specific and operational (e.g. "Reducing energy loss in warehouse doorways").',
]

export const NBE_PERSONALISATION_RULES: readonly string[] = [
  'Use only provided data: company name, industry/category, location, website, product line, campaign context.',
  'Address the recipient as the named company; suburb/postcode may appear only as light location context, never as the reason you are emailing a group of local businesses.',
  'Prioritise the prompt industry focus and category over generic "manufacturing" language when they differ.',
  'Never invent employee counts, warehouse size, revenue, equipment, facility problems, or projects.',
  'Never hallucinate; if detail is missing, stay general.',
  'When context is uncertain, use careful language (e.g. may be relevant, where applicable, depending on the application, if you have an upcoming requirement).',
  'Do not present assumptions as facts.',
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
  'Opens for this company by name — not a geographic or industry blast to "facilities in [suburb]"',
  'Includes a brief NBE introduction (industrial door systems) before product detail',
  'Benefits match the supplied industry/category focus, not generic manufacturing copy',
  'Sounds like a real person — experienced engineer or business owner, not a salesperson',
  'Concise; every sentence useful',
  'All claims supported; no invented specs or customer assumptions',
  'Professional Australian English; no marketing clichés or fake urgency',
  'Authentic; customer likely to trust the sender',
  'Exactly one soft CTA',
  `Under ${NBE_EMAIL_WORD_TARGET_MAX} words (hard max ${NBE_EMAIL_WORD_ABSOLUTE_MAX})`,
  'Reflects NBE values: trust, expertise, easy to work with',
  'If any check fails, rewrite before returning JSON; do not expose this checklist in output',
]

export function formatNbeCtaGuidanceBlock(): string {
  return [
    '## Soft call to action',
    'Use exactly one low-pressure offer of assistance. Style examples (vary wording across emails):',
    ...NBE_SOFT_CTA_EXAMPLES.map((o) => `- ${o}`),
    'Prefer soft assistance over site-inspection or quotation pressure unless the library brief explicitly requires it.',
    'Never pressure the customer, repeatedly ask for meetings, or use countdowns or urgency.',
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
    'Select only benefits relevant to this industry and application.',
    'Typical problems:',
    ...g.problems.map((p) => `- ${p}`),
    'May emphasise where relevant:',
    ...g.focus.map((p) => `- ${p}`),
  ].join('\n')
}

export function formatNbeIndustryGuidance(industrySlug: SalesIndustrySlug): string {
  const focus = INDUSTRY_GUIDANCE[industrySlug] ?? INDUSTRY_GUIDANCE.general
  return [
    '## Industry focus (NBE methodology)',
    'Use this section and the Context "Prompt industry focus" / category — not generic manufacturing wording unless that is the supplied focus.',
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
    'You write customer communications on behalf of NBE Australia (industrial rapid doors and PVC door systems).',
    'Communicate as an experienced engineering professional or company director — not as a salesperson or marketing agency.',
    'Build trust and demonstrate expertise; build confidence rather than excitement.',
    'Each email must feel written for this specific business while following the NBE methodology in the user prompt.',
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
