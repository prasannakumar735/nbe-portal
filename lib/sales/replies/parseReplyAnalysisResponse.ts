import { z } from 'zod'
import {
  SALES_REPLY_ANALYSIS_CATEGORIES,
  type SalesReplyAnalysisCategory,
} from '@/lib/sales/constants/replyAnalysis'

const sentimentSchema = z.enum(['positive', 'neutral', 'negative'])
const buyingIntentSchema = z.enum(['high', 'medium', 'low', 'none'])
const urgencySchema = z.enum(['high', 'medium', 'low'])

export const replyAnalysisModelOutputSchema = z.object({
  summary: z.string().min(1).max(20_000),
  sentiment: sentimentSchema,
  buying_intent: buyingIntentSchema,
  categories: z.array(z.string().min(1).max(80)).min(0).max(9),
  urgency: urgencySchema,
  suggested_next_action: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
})

export type ReplyAnalysisModelOutput = z.infer<typeof replyAnalysisModelOutputSchema>

const CATEGORY_LABEL_TO_SLUG: Record<string, SalesReplyAnalysisCategory> = {
  interested: 'interested',
  'needs quote': 'needs_quote',
  needs_quote: 'needs_quote',
  'wants site inspection': 'wants_site_inspection',
  wants_site_inspection: 'wants_site_inspection',
  'technical question': 'technical_question',
  technical_question: 'technical_question',
  'pricing question': 'pricing_question',
  pricing_question: 'pricing_question',
  'existing customer': 'existing_customer',
  existing_customer: 'existing_customer',
  'not interested': 'not_interested',
  not_interested: 'not_interested',
  'wrong contact': 'wrong_contact',
  wrong_contact: 'wrong_contact',
  unsubscribe: 'unsubscribe',
}

function normalizeCategoryLabel(raw: string): SalesReplyAnalysisCategory | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  const slug = CATEGORY_LABEL_TO_SLUG[key] ?? CATEGORY_LABEL_TO_SLUG[key.replace(/ /g, '_')]
  if (slug) return slug
  if ((SALES_REPLY_ANALYSIS_CATEGORIES as readonly string[]).includes(key.replace(/ /g, '_'))) {
    return key.replace(/ /g, '_') as SalesReplyAnalysisCategory
  }
  return null
}

export function normalizeReplyAnalysisCategories(raw: string[]): SalesReplyAnalysisCategory[] {
  const out: SalesReplyAnalysisCategory[] = []
  for (const item of raw) {
    const slug = normalizeCategoryLabel(item)
    if (slug && !out.includes(slug)) out.push(slug)
  }
  return out
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

export function parseReplyAnalysisModelOutput(raw: string): ReplyAnalysisModelOutput {
  const jsonText = extractJsonObject(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Reply analysis response was not valid JSON.')
  }

  const validated = replyAnalysisModelOutputSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`Reply analysis JSON validation failed: ${validated.error.message}`)
  }

  const categories = normalizeReplyAnalysisCategories(validated.data.categories)
  if (validated.data.categories.length > 0 && categories.length === 0) {
    throw new Error('Reply analysis contained no recognised categories.')
  }

  return {
    ...validated.data,
    categories,
  }
}

export type ParsedReplyAnalysisForStorage = {
  summary: string
  sentiment: string
  buying_intent: string
  categories: SalesReplyAnalysisCategory[]
  urgency: string
  suggested_next_action: string
  confidence: number
}

export function toStoredReplyAnalysisFields(
  output: ReplyAnalysisModelOutput,
): ParsedReplyAnalysisForStorage {
  const categories = normalizeReplyAnalysisCategories(output.categories)
  return {
    summary: output.summary.trim(),
    sentiment: output.sentiment,
    buying_intent: output.buying_intent,
    categories,
    urgency: output.urgency,
    suggested_next_action: output.suggested_next_action.trim(),
    confidence: output.confidence,
  }
}
