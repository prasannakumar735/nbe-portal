import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const DEFAULT_SENDS_PER_MINUTE = 30

function readSendsPerMinute(): number {
  const raw = process.env.SALES_EMAIL_SEND_RATE_PER_MINUTE?.trim()
  if (!raw) return DEFAULT_SENDS_PER_MINUTE
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SENDS_PER_MINUTE
  return Math.min(120, Math.floor(n))
}

function buildUpstashRatelimiter(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(readSendsPerMinute(), '60 s'),
    prefix: '@nbe/sales-email-send',
  })
}

let _limiter: Ratelimit | null | undefined = undefined

function getLimiter(): Ratelimit | null {
  if (_limiter === undefined) {
    _limiter = buildUpstashRatelimiter()
  }
  return _limiter
}

// Fallback in-memory window used when Upstash is not configured (local dev).
// On Vercel this path is not reachable if UPSTASH_* env vars are set.
const _devTimestamps: number[] = []

function devAcquire(limit: number): void {
  const now = Date.now()
  const cutoff = now - 60_000
  while (_devTimestamps.length > 0 && _devTimestamps[0]! < cutoff) {
    _devTimestamps.shift()
  }
  if (_devTimestamps.length >= limit) {
    throw new Error(
      'Email send rate limit exceeded (in-memory, dev-only). Configure UPSTASH_* for production.',
    )
  }
  _devTimestamps.push(now)
}

/**
 * Acquire a send slot.
 *
 * Uses Upstash Redis sliding-window rate limiting when UPSTASH_* env vars are
 * set (production). Falls back to in-memory for local dev. The in-memory path
 * is per-isolate and therefore NOT safe for concurrent Vercel invocations — it
 * is intentionally left unsafe to make the missing configuration obvious.
 */
export async function acquireEmailSendRateLimit(): Promise<void> {
  const limiter = getLimiter()
  if (limiter) {
    const { success, remaining } = await limiter.limit('global')
    if (!success) {
      throw new Error(
        `Email send rate limit exceeded (${remaining} remaining). Will retry next dispatch cycle.`,
      )
    }
    return
  }
  devAcquire(readSendsPerMinute())
}

/** Test helper — invalidate the cached limiter instance. */
export function resetEmailSendRateLimitForTests(): void {
  _limiter = undefined
  _devTimestamps.length = 0
}

export function getEmailSendRateLimitPerMinute(): number {
  return readSendsPerMinute()
}
