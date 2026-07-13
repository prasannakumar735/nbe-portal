import { z } from 'zod'
import type { SalesAssistantStructuredResult } from '@/lib/sales/types/salesAssistant.types'

const sectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
})

const productSchema = z.object({
  slug: z.string(),
  label: z.string(),
  rationale: z.string(),
})

const followUpSchema = z.object({
  suggestedTiming: z.string(),
  talkingPoints: z.array(z.string()),
  note: z.string().optional(),
})

export const salesAssistantStructuredResultSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sections: z.array(sectionSchema).default([]),
  bulletActions: z.array(z.string()).default([]),
  recommendedProducts: z.array(productSchema).optional(),
  followUpDraft: followUpSchema
    .optional()
    .transform((v) =>
      v
        ? {
            ...v,
            note:
              v.note ??
              'Talking points only — manager drafts and approves any customer email separately.',
          }
        : undefined,
    ),
  inspectionNotes: z.string().optional(),
  quoteSummary: z.string().optional(),
})

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

export function parseSalesAssistantModelOutput(raw: string): SalesAssistantStructuredResult {
  const jsonText = extractJsonObject(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return {
      title: 'Assistant response',
      summary: raw.trim(),
      sections: [],
      bulletActions: [],
    }
  }
  return salesAssistantStructuredResultSchema.parse(parsed)
}
