/**
 * Inherited by every library prompt at assembly time (not stored per row).
 * Keeps Australian English and consultative B2B tone consistent.
 */

export const SALES_AI_GLOBAL_WRITING_RULES: readonly string[] = [
  'Use Australian English spelling and conventions (e.g. organisation, colour, metre).',
  'Maintain a professional, consultative tone; write as a trusted industrial partner, not a marketer.',
  'Do not use exaggerated marketing language, hype, or unsubstantiated superlatives.',
  'Do not create fake urgency (e.g. “act now”, “limited time”, “last chance”).',
  'Include exactly one clear call to action aligned with the prompt CTA.',
  'Be concise and specific to the recipient’s operation and industry context.',
]

export const SALES_AI_DEFAULT_OUTPUT_FORMAT = [
  'Respond with a single JSON object only (no markdown fences, no commentary):',
  '{"subject":"...","body":"..."}',
  'The body may contain newline characters inside the JSON string.',
].join(' ')

export function formatGlobalWritingRulesBlock(): string {
  return ['## Global writing rules (always apply)', ...SALES_AI_GLOBAL_WRITING_RULES.map((r) => `- ${r}`)].join(
    '\n',
  )
}
