import type { SalesGenerationLogStatus } from '@/lib/sales/constants/generationLogStatuses'
import { ProviderRateLimitError } from '@/lib/sales/rate-limit/providerRateLimiter'

const MAX_FAILURE_REASON_LENGTH = 2000

export type GenerationFailureClassification = {
  status: Exclude<SalesGenerationLogStatus, 'success'>
  failureReason: string
}

export class GenerationEmptyResponseError extends Error {
  constructor(message = 'LLM returned an empty response.') {
    super(message)
    this.name = 'GenerationEmptyResponseError'
  }
}

export class GenerationMalformedResponseError extends Error {
  constructor(message = 'LLM returned a malformed response.') {
    super(message)
    this.name = 'GenerationMalformedResponseError'
  }
}

export class GenerationInvalidPromptError extends Error {
  constructor(message = 'Email generation prompt is invalid.') {
    super(message)
    this.name = 'GenerationInvalidPromptError'
  }
}

export class GenerationTimeoutError extends Error {
  constructor(message = 'LLM request timed out.') {
    super(message)
    this.name = 'GenerationTimeoutError'
  }
}

function normalizeFailureReason(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (!trimmed) return 'Unknown generation error.'
  return trimmed.slice(0, MAX_FAILURE_REASON_LENGTH)
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function isTimeoutError(error: unknown, message: string): boolean {
  if (error instanceof GenerationTimeoutError) return true
  const lower = message.toLowerCase()
  if (lower.includes('timeout') || lower.includes('timed out')) return true
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') return true
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return true
  }
  return false
}

function isRateLimitError(error: unknown, message: string): boolean {
  if (error instanceof ProviderRateLimitError) return true
  const lower = message.toLowerCase()
  return (
    lower.includes('rate limit') ||
    lower.includes('rate_limited') ||
    lower.includes('too many requests') ||
    /\b429\b/.test(message)
  )
}

function isInvalidPromptError(error: unknown, message: string): boolean {
  if (error instanceof GenerationInvalidPromptError) return true
  const lower = message.toLowerCase()
  return (
    lower.includes('invalid prompt') ||
    lower.includes('prompt is invalid') ||
    lower.includes('no active email template')
  )
}

function isEmptyResponseError(error: unknown, message: string): boolean {
  if (error instanceof GenerationEmptyResponseError) return true
  const lower = message.toLowerCase()
  return lower.includes('empty response') || lower.includes('empty llm response')
}

function isMalformedResponseError(error: unknown, message: string): boolean {
  if (error instanceof GenerationMalformedResponseError) return true
  const lower = message.toLowerCase()
  return (
    lower.includes('malformed response') ||
    lower.includes('invalid json') ||
    lower.includes('missing subject') ||
    lower.includes('missing body') ||
    lower.includes('unexpected response')
  )
}

function isUnknownProviderError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('unknown llm provider') || lower.includes('unknown provider')
}

function isProviderError(error: unknown, message: string): boolean {
  const lower = message.toLowerCase()
  if (/not implemented yet/i.test(message)) return true
  if (isUnknownProviderError(message)) return true
  if (lower.includes('provider error')) return true
  if (lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('api key')) {
    return true
  }
  if (/\b(401|403|500|502|503|504)\b/.test(message)) return true
  if (error instanceof Error && error.name.includes('Provider')) return true
  return false
}

/**
 * Map thrown errors to persisted generation log status + normalized failure reason.
 */
export function classifyGenerationFailure(error: unknown): GenerationFailureClassification {
  const message = messageFromError(error)

  if (isRateLimitError(error, message)) {
    return {
      status: 'rate_limited',
      failureReason: normalizeFailureReason(
        error instanceof ProviderRateLimitError ? error.message : message,
      ),
    }
  }

  if (isTimeoutError(error, message)) {
    return {
      status: 'timeout',
      failureReason: normalizeFailureReason(message),
    }
  }

  if (isInvalidPromptError(error, message)) {
    return {
      status: 'failed',
      failureReason: normalizeFailureReason(message),
    }
  }

  if (isEmptyResponseError(error, message)) {
    return {
      status: 'provider_error',
      failureReason: normalizeFailureReason(message),
    }
  }

  if (isMalformedResponseError(error, message)) {
    return {
      status: 'provider_error',
      failureReason: normalizeFailureReason(message),
    }
  }

  if (isProviderError(error, message)) {
    return {
      status: 'provider_error',
      failureReason: normalizeFailureReason(message),
    }
  }

  return {
    status: 'failed',
    failureReason: normalizeFailureReason(message),
  }
}
