const DEFAULT_SENDS_PER_MINUTE = 30

function readSendsPerMinute(): number {
  const raw = process.env.SALES_EMAIL_SEND_RATE_PER_MINUTE?.trim()
  if (!raw) return DEFAULT_SENDS_PER_MINUTE
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SENDS_PER_MINUTE
  return Math.min(120, Math.floor(n))
}

/** Sliding window timestamps (per runtime isolate). */
const recentSendTimestamps: number[] = []

function pruneWindow(now: number, windowMs: number): void {
  const cutoff = now - windowMs
  while (recentSendTimestamps.length > 0 && recentSendTimestamps[0]! < cutoff) {
    recentSendTimestamps.shift()
  }
}

/**
 * Block until an outbound send slot is available under SALES_EMAIL_SEND_RATE_PER_MINUTE.
 */
export async function acquireEmailSendRateLimit(): Promise<void> {
  const limit = readSendsPerMinute()
  const windowMs = 60_000
  const maxWaitMs = 120_000
  const started = Date.now()

  for (;;) {
    const now = Date.now()
    pruneWindow(now, windowMs)
    if (recentSendTimestamps.length < limit) {
      recentSendTimestamps.push(now)
      return
    }
    if (now - started > maxWaitMs) {
      throw new Error('Email send rate limit wait exceeded.')
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

/** Test helper — reset in-memory window. */
export function resetEmailSendRateLimitForTests(): void {
  recentSendTimestamps.length = 0
}

export function getEmailSendRateLimitPerMinute(): number {
  return readSendsPerMinute()
}
