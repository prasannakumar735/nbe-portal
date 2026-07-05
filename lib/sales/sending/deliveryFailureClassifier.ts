import type { SalesEmailDeliveryLogStatus } from '@/lib/sales/constants/emailDeliveryLogStatuses'

const MAX_FAILURE_REASON_LENGTH = 2000

export type DeliveryFailureClassification = {
  status: Exclude<SalesEmailDeliveryLogStatus, 'success'>
  failureReason: string
  queueStatus: 'failed' | 'bounced'
}

export class DeliveryTimeoutError extends Error {
  constructor(message = 'Email provider request timed out.') {
    super(message)
    this.name = 'DeliveryTimeoutError'
  }
}

function normalizeFailureReason(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (!trimmed) return 'Unknown delivery error.'
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

function isBounce(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('bounced') ||
    lower.includes('bounce') ||
    lower.includes('mailbox rejected') ||
    lower.includes('mailbox unavailable') ||
    lower.includes('user unknown') ||
    lower.includes('550 ') ||
    lower.includes('551 ')
  )
}

function isInvalidRecipient(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('invalid recipient') ||
    lower.includes('invalid email') ||
    lower.includes('bad address') ||
    lower.includes('address rejected')
  )
}

function isSmtpFailure(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('smtp') || /\b(421|450|451|452|554)\b/.test(message)
}

function isProviderError(message: string): boolean {
  const lower = message.toLowerCase()
  if (/not implemented yet/i.test(message)) return true
  if (lower.includes('provider error')) return true
  if (lower.includes('microsoft graph sendmail failed')) return true
  if (lower.includes('throttl') || lower.includes('too many requests')) return true
  if (/\b429\b/.test(message)) return true
  if (lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('api key')) {
    return true
  }
  if (/\b(401|403|500|502|503|504)\b/.test(message)) return true
  return false
}

function isTimeout(message: string, error: unknown): boolean {
  if (error instanceof DeliveryTimeoutError) return true
  const lower = message.toLowerCase()
  if (lower.includes('timeout') || lower.includes('timed out')) return true
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') return true
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return true
  }
  return false
}

export function classifyDeliveryFailure(error: unknown): DeliveryFailureClassification {
  const message = messageFromError(error)

  if (isBounce(message) || isInvalidRecipient(message)) {
    return {
      status: 'bounced',
      failureReason: normalizeFailureReason(message),
      queueStatus: 'bounced',
    }
  }

  if (isTimeout(message, error)) {
    return {
      status: 'failed',
      failureReason: normalizeFailureReason(message),
      queueStatus: 'failed',
    }
  }

  if (isProviderError(message) || isSmtpFailure(message)) {
    return {
      status: 'provider_error',
      failureReason: normalizeFailureReason(message),
      queueStatus: 'failed',
    }
  }

  return {
    status: 'failed',
    failureReason: normalizeFailureReason(message),
    queueStatus: 'failed',
  }
}
