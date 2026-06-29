import type { SalesEmailQualityRecommendation } from '@/lib/sales/constants/emailQualityRecommendations'
import type {
  GeneratedEmailQualityInput,
  GeneratedEmailQualityResult,
} from '@/lib/sales/types/emailQuality.types'
import { SALES_EMAIL_SPAM_KEYWORDS } from '@/lib/sales/quality/spamKeywords'

const MIN_BODY_LENGTH = 120
const MIN_SUBJECT_LENGTH = 3

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function countSpamKeywordHits(text: string): number {
  const lower = text.toLowerCase()
  return SALES_EMAIL_SPAM_KEYWORDS.reduce(
    (count, keyword) => (lower.includes(keyword) ? count + 1 : count),
    0,
  )
}

function computePersonalizationScore(body: string): number {
  const lower = body.toLowerCase()
  let score = 45
  if (/\b(you|your|yours)\b/.test(lower)) score += 20
  if (/\b(company|team|facility|warehouse|operations)\b/.test(lower)) score += 15
  if (body.length >= MIN_BODY_LENGTH) score += 10
  if (body.split(/\s+/).length >= 80) score += 10
  return clampScore(score)
}

function computeSalesStrengthScore(body: string): number {
  const lower = body.toLowerCase()
  let score = 40
  if (/\b(inspection|consultation|audit|review|quote|assessment)\b/.test(lower)) score += 25
  if (/\b(efficiency|energy|safety|downtime|maintenance)\b/.test(lower)) score += 15
  if (/\?/.test(body)) score += 10
  if (body.length >= MIN_BODY_LENGTH) score += 10
  return clampScore(score)
}

function computeGrammarScore(body: string): number {
  let score = 85
  if (body.length < MIN_BODY_LENGTH) score -= 35
  if (!/[.!?]/.test(body.trim())) score -= 15
  if (/\b(teh|recieve|occured)\b/i.test(body)) score -= 20
  return clampScore(score)
}

function deriveRecommendation(
  overall: number,
  spamRisk: number,
  subject: string,
  body: string,
): SalesEmailQualityRecommendation {
  const subjectTrimmed = subject.trim()
  if (subjectTrimmed.length < MIN_SUBJECT_LENGTH) return 'blocked'
  if (!body.trim()) return 'blocked'
  if (spamRisk >= 75) return 'blocked'
  if (overall >= 85 && spamRisk < 25) return 'excellent'
  if (overall >= 70 && spamRisk < 40) return 'good'
  if (overall >= 50) return 'needs_review'
  return 'poor'
}

function computeOverallScore(
  spamRisk: number,
  personalization: number,
  salesStrength: number,
  grammar: number,
): number {
  const weighted =
    personalization * 0.3 + salesStrength * 0.35 + grammar * 0.25 + (100 - spamRisk) * 0.1
  return clampScore(weighted)
}

/**
 * Placeholder quality gate (no LLM). Phase 5 runs after generation and before manager review.
 */
export function scoreGeneratedEmail(input: GeneratedEmailQualityInput): GeneratedEmailQualityResult {
  const subject = input.subject ?? ''
  const body = input.body ?? ''

  if (subject.trim().length < MIN_SUBJECT_LENGTH || !body.trim()) {
    return {
      spam_risk_score: 0,
      personalization_score: 0,
      sales_strength_score: 0,
      grammar_score: 0,
      overall_score: 0,
      recommendation: 'blocked',
    }
  }

  const spamHits = countSpamKeywordHits(`${subject} ${body}`)
  const spam_risk_score = clampScore(15 + spamHits * 22 + (body.length < MIN_BODY_LENGTH ? 25 : 0))

  const personalization_score = computePersonalizationScore(body)
  const sales_strength_score =
    body.length < MIN_BODY_LENGTH ? clampScore(25) : computeSalesStrengthScore(body)
  const grammar_score = computeGrammarScore(body)

  const overall_score = computeOverallScore(
    spam_risk_score,
    personalization_score,
    sales_strength_score,
    grammar_score,
  )

  const recommendation = deriveRecommendation(overall_score, spam_risk_score, subject, body)

  return {
    spam_risk_score,
    personalization_score,
    sales_strength_score,
    grammar_score,
    overall_score,
    recommendation,
  }
}
