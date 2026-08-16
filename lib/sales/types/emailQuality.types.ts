import type { SalesEmailQualityRecommendation } from '@/lib/sales/constants/emailQualityRecommendations'

export type { SalesEmailQualityRecommendation } from '@/lib/sales/constants/emailQualityRecommendations'

export { SALES_EMAIL_QUALITY_RECOMMENDATIONS } from '@/lib/sales/constants/emailQualityRecommendations'

export type SalesEmailQualityScore = {
  id: string
  generated_email_id: string
  spam_risk_score: number
  personalization_score: number
  sales_strength_score: number
  grammar_score: number
  overall_score: number
  recommendation: SalesEmailQualityRecommendation
  created_at: string
}

export type SalesEmailQualityScoreInsert = {
  generated_email_id: string
  spam_risk_score: number
  personalization_score: number
  sales_strength_score: number
  grammar_score: number
  overall_score: number
  recommendation: SalesEmailQualityRecommendation
}

/** Input for placeholder scorer (Phase 5 will pass generated email content). */
export type GeneratedEmailQualityInput = {
  subject: string
  body: string
}

export type GeneratedEmailQualityResult = Omit<SalesEmailQualityScoreInsert, 'generated_email_id'>
