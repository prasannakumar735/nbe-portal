export const SALES_EMAIL_TEMPLATE_TONES = [
  'professional',
  'friendly',
  'technical',
  'sales-focused',
  'urgent',
] as const

export type SalesEmailTemplateTone = (typeof SALES_EMAIL_TEMPLATE_TONES)[number]
