/** Backoff delays after failed send attempt (Phase 6 / 9). */
const RETRY_DELAY_MS_BY_ATTEMPT: Readonly<Record<1 | 2 | 3, number>> = {
  1: 5 * 60 * 1000,
  2: 15 * 60 * 1000,
  3: 60 * 60 * 1000,
}

/** Random spread added to backoff to avoid synchronized retries (0–30s). */
export const MAX_RETRY_JITTER_MS = 30 * 1000

export const PERMANENT_FAILURE_ATTEMPT = 4

export function getRetryJitterMs(): number {
  return Math.floor(Math.random() * (MAX_RETRY_JITTER_MS + 1))
}

export type CalculateNextRetryTimeResult =
  | { scheduledAt: Date; attempt: number; jitterMs: number }
  | { permanentFailure: true; attempt: number }

/**
 * Exponential backoff schedule after a failed send.
 * attempt 1 → +5m, 2 → +15m, 3 → +1h, 4+ → permanent failure (no retry).
 * Adds 0–30s jitter to reduce retry storms.
 */
export function calculateNextRetryTime(
  attempt: number,
  from: Date = new Date(),
): CalculateNextRetryTimeResult {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error('Retry attempt must be a positive integer.')
  }

  if (attempt >= PERMANENT_FAILURE_ATTEMPT) {
    return { permanentFailure: true, attempt }
  }

  const delayMs = RETRY_DELAY_MS_BY_ATTEMPT[attempt as 1 | 2 | 3]
  if (delayMs == null) {
    return { permanentFailure: true, attempt }
  }

  const jitterMs = getRetryJitterMs()

  return {
    scheduledAt: new Date(from.getTime() + delayMs + jitterMs),
    attempt,
    jitterMs,
  }
}

export function shouldScheduleEmailSendRetry(attempt: number): boolean {
  const result = calculateNextRetryTime(attempt)
  return !('permanentFailure' in result)
}
