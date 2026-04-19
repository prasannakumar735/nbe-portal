import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { ApiRateLimitTier } from '@/lib/security/apiPathTiers'
import { checkSlidingWindow } from '@/lib/security/rateLimitEdge'

/** Auth endpoints — brute-force / enumeration protection */
const LIMIT_AUTH = 10
/** Stricter tier for high-value read/write APIs */
const LIMIT_SENSITIVE = 30
/** Default for remaining /api routes */
const LIMIT_GENERAL = 60

let redisSingleton: Redis | null | undefined

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    redisSingleton = null
    return null
  }
  redisSingleton = new Redis({ url, token })
  return redisSingleton
}

let limiterAuth: Ratelimit | undefined
let limiterSensitive: Ratelimit | undefined
let limiterGeneral: Ratelimit | undefined

function getRatelimit(tier: ApiRateLimitTier): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null

  if (tier === 'auth') {
    if (!limiterAuth) {
      limiterAuth = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(LIMIT_AUTH, '1 m'),
        prefix: 'rl:auth',
        analytics: false,
      })
    }
    return limiterAuth
  }

  if (tier === 'sensitive') {
    if (!limiterSensitive) {
      limiterSensitive = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(LIMIT_SENSITIVE, '1 m'),
        prefix: 'rl:sensitive',
        analytics: false,
      })
    }
    return limiterSensitive
  }

  if (!limiterGeneral) {
    limiterGeneral = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LIMIT_GENERAL, '1 m'),
      prefix: 'rl:general',
      analytics: false,
    })
  }
  return limiterGeneral
}

export type DistributedRateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number }

/**
 * Distributed limit when Upstash env is set; otherwise falls back to in-memory sliding window (per isolate).
 */
export async function enforceDistributedRateLimit(
  ip: string,
  pathname: string,
  tier: ApiRateLimitTier,
): Promise<DistributedRateLimitResult> {
  const limiter = getRatelimit(tier)
  const pathKey = pathname.split('/').slice(0, 6).join('/') || pathname
  const identifier =
    tier === 'auth' ? `auth:${ip}` : tier === 'sensitive' ? `s:${ip}:${pathKey}` : `g:${ip}`

  if (limiter) {
    const res = await limiter.limit(identifier)
    if (res.pending) {
      try {
        await res.pending
      } catch {
        // analytics / multi-region sync — non-fatal
      }
    }
    if (!res.success) {
      const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000))
      return { ok: false, retryAfterSec }
    }
    return { ok: true }
  }

  const max =
    tier === 'auth' ? LIMIT_AUTH : tier === 'sensitive' ? LIMIT_SENSITIVE : LIMIT_GENERAL
  const windowMs = 60_000
  const fbKey = `fb:${tier}:${ip}:${tier === 'sensitive' ? pathKey : ''}`
  if (!checkSlidingWindow(fbKey, max, windowMs)) {
    return { ok: false, retryAfterSec: 60 }
  }
  return { ok: true }
}
