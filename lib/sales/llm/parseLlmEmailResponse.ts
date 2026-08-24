import {
  GenerationEmptyResponseError,
  GenerationMalformedResponseError,
} from '@/lib/sales/generation/generationFailureClassifier'

export type ParsedLlmEmail = {
  subject: string
  body: string
}

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim()
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

function parseJsonEmail(raw: string): ParsedLlmEmail | null {
  const text = stripMarkdownFence(raw)
  // Try the whole text first, then scan for the first '{' (handles preamble/commentary)
  const candidates: string[] = [text]
  const firstBrace = text.indexOf('{')
  if (firstBrace > 0) candidates.push(text.slice(firstBrace))
  for (const candidate of candidates) {
    if (!candidate.startsWith('{')) continue
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      const subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : ''
      const body = typeof parsed.body === 'string' ? parsed.body.trim() : ''
      if (!subject && !body) continue
      return { subject, body }
    } catch {
      // try next candidate
    }
  }
  return null
}

function parseLabeledEmail(raw: string): ParsedLlmEmail | null {
  const subjectMatch = /(?:^|\n)\s*subject\s*:\s*(.+?)(?:\n\s*\n|\n\s*body\s*:)/is.exec(raw)
  const bodyMatch = /(?:^|\n)\s*body\s*:\s*([\s\S]+)$/is.exec(raw)
  if (!subjectMatch || !bodyMatch) return null
  const subject = subjectMatch[1].trim()
  const body = bodyMatch[1].trim()
  if (!subject || !body) return null
  return { subject, body }
}

function parseSubjectFirstBlock(raw: string): ParsedLlmEmail | null {
  const lines = raw.trim().split(/\r?\n/)
  if (lines.length < 2) return null
  const first = lines[0].trim()
  const subject =
    /^subject\s*:\s*/i.test(first) ? first.replace(/^subject\s*:\s*/i, '').trim() : first
  const body = lines.slice(1).join('\n').trim()
  if (!subject || !body) return null
  return { subject, body }
}

/**
 * Normalize free-form or JSON LLM output into subject + body.
 */
export function parseLlmEmailResponse(raw: string): ParsedLlmEmail {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new GenerationEmptyResponseError()
  }

  const parsed =
    parseJsonEmail(trimmed) ?? parseLabeledEmail(trimmed) ?? parseSubjectFirstBlock(trimmed)

  if (!parsed?.subject || !parsed.body) {
    throw new GenerationMalformedResponseError(
      !parsed?.subject
        ? 'LLM response missing subject.'
        : 'LLM response missing body.',
    )
  }

  return parsed
}
