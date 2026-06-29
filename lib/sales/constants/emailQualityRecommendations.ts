/** Quality gate recommendation for manager review (Phase 4.7). */

export const SALES_EMAIL_QUALITY_RECOMMENDATIONS = [
  'excellent',
  'good',
  'needs_review',
  'poor',
  'blocked',
] as const

export type SalesEmailQualityRecommendation = (typeof SALES_EMAIL_QUALITY_RECOMMENDATIONS)[number]
