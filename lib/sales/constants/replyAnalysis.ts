/** Inbound reply categories (AI analysis — Phase 10.5+). */
export const SALES_REPLY_ANALYSIS_CATEGORIES = [
  'interested',
  'needs_quote',
  'wants_site_inspection',
  'technical_question',
  'pricing_question',
  'existing_customer',
  'not_interested',
  'wrong_contact',
  'unsubscribe',
] as const

export type SalesReplyAnalysisCategory = (typeof SALES_REPLY_ANALYSIS_CATEGORIES)[number]

export const SALES_REPLY_ANALYSIS_STATUSES = ['pending', 'completed', 'failed'] as const

export type SalesReplyAnalysisStatus = (typeof SALES_REPLY_ANALYSIS_STATUSES)[number]

/** Default version for first analysis row per inbound message. */
export const SALES_REPLY_ANALYSIS_INITIAL_VERSION = 1
