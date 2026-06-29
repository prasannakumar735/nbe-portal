import { z } from 'zod'
import { SALES_EMAIL_QUALITY_RECOMMENDATIONS } from '@/lib/sales/constants/emailQualityRecommendations'

const scoreField = z.number().int().min(0).max(100)

export const salesEmailQualityListQuerySchema = z.object({
  generatedEmailId: z.string().uuid().optional(),
  recommendation: z.enum(SALES_EMAIL_QUALITY_RECOMMENDATIONS).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export const createSalesEmailQualityScoreBodySchema = z.object({
  generatedEmailId: z.string().uuid(),
  spamRiskScore: scoreField,
  personalizationScore: scoreField,
  salesStrengthScore: scoreField,
  grammarScore: scoreField,
  overallScore: scoreField,
  recommendation: z.enum(SALES_EMAIL_QUALITY_RECOMMENDATIONS),
})

export const scoreGeneratedEmailBodySchema = z.object({
  subject: z.string(),
  body: z.string(),
})
