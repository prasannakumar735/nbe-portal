/** AI Sales Assistant capabilities (Phase 14 — suggestions only, no auto-send). */

export const SALES_ASSISTANT_CAPABILITIES = [
  'summarise_replies',
  'suggest_next_actions',
  'recommend_products',
  'recommend_followups',
  'generate_inspection_notes',
  'prepare_quote_summary',
] as const

export type SalesAssistantCapability = (typeof SALES_ASSISTANT_CAPABILITIES)[number]

export const SALES_ASSISTANT_CAPABILITY_LABELS: Record<SalesAssistantCapability, string> = {
  summarise_replies: 'Summarise replies',
  suggest_next_actions: 'Suggest next actions',
  recommend_products: 'Recommend products',
  recommend_followups: 'Recommend follow-ups',
  generate_inspection_notes: 'Generate inspection notes',
  prepare_quote_summary: 'Prepare quote summaries',
}

export const SALES_ASSISTANT_DISCLAIMER =
  'AI suggestions only. Manager must review before any customer contact, quote, or send.'
