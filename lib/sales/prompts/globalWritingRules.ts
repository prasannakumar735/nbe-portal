/**
 * Inherited by every library prompt at assembly time (not stored per row).
 * Core list kept for UI comparison; full methodology lives in nbeB2bSalesEmailFramework.
 */

import {
  NBE_BANNED_PHRASES,
  NBE_WRITING_STYLE_RULES,
  formatNbeFrameworkSystemBrief,
} from '@/lib/sales/prompts/nbeB2bSalesEmailFramework'

export {
  NBE_BANNED_PHRASES,
  NBE_EMAIL_WORD_ABSOLUTE_MAX,
  NBE_EMAIL_WORD_TARGET_MAX,
  NBE_EMAIL_WORD_TARGET_MIN,
  NBE_FINAL_VALIDATION_CHECKLIST,
  formatNbeFrameworkSystemBrief,
  formatNbeFrameworkUserSections,
} from '@/lib/sales/prompts/nbeB2bSalesEmailFramework'

/** Summary rules shown in Prompt Library comparison (Global Rules row). */
export const SALES_AI_GLOBAL_WRITING_RULES: readonly string[] = [
  ...NBE_WRITING_STYLE_RULES,
  'Do not claim unsupported performance, savings percentages, payback periods, or guaranteed ROI unless verified NBE Australia data is provided in the prompt.',
  `Banned phrase examples: ${NBE_BANNED_PHRASES.slice(0, 6).join('; ')}…`,
  'NBE five-part structure: observation → problem → solution → benefits → low-pressure CTA.',
  'Standard CTAs: free site inspection, no-obligation site assessment, product recommendation, quotation.',
]

export const SALES_AI_DEFAULT_OUTPUT_FORMAT = [
  'Respond with a single JSON object only (no markdown fences, no commentary):',
  '{"subject":"...","body":"..."}',
  'The body may contain newline characters inside the JSON string.',
].join(' ')

export function formatGlobalWritingRulesBlock(): string {
  return ['## Global writing rules (NBE — always apply)', ...SALES_AI_GLOBAL_WRITING_RULES.map((r) => `- ${r}`)].join(
    '\n',
  )
}
