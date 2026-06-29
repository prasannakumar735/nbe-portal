/** Placeholder spam signals for heuristic quality scoring (Phase 4.7). */
export const SALES_EMAIL_SPAM_KEYWORDS = [
  'buy now',
  'limited offer',
  'act fast',
  'exclusive deal',
  'urgent response',
] as const

export type SalesEmailSpamKeyword = (typeof SALES_EMAIL_SPAM_KEYWORDS)[number]
