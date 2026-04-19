import { Redis } from '@upstash/redis'

/** Failure counter key prefix — 10 failures triggers a temporary ban. */
const PREFIX_FAILURES = 'ip:failures:'
/** Ban flag key — TTL = ban duration. */
const PREFIX_BAN = 'ip:ban:'

const FAILURE_THRESHOLD = 10
/** Exported for Retry-After headers when a temp IP ban blocks `/api`. */
export const IP_BAN_RETRY_AFTER_SEC = 600 // 10 minutes
const BAN_SECONDS = IP_BAN_RETRY_AFTER_SEC

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

type MemEntry = { failures: number; banUntil: number | null }

const memStore = new Map<string, MemEntry>()
const MEM_MAX = 50_000

function memPruneIfNeeded() {
  if (memStore.size <= MEM_MAX) return
  const now = Date.now()
  for (const [k, v] of memStore) {
    if (v.banUntil && v.banUntil <= now && v.failures === 0) memStore.delete(k)
  }
}

function ipKey(ip: string): string {
  const t = ip.trim().toLowerCase()
  if (!t || t === 'unknown') return ''
  return encodeURIComponent(t)
}

function memIsBlocked(k: string): boolean {
  const e = memStore.get(k)
  if (!e) return false
  const now = Date.now()
  if (e.banUntil !== null && now < e.banUntil) return true
  if (e.banUntil !== null && now >= e.banUntil) {
    e.banUntil = null
    e.failures = 0
  }
  return false
}

/**
 * Whether this client IP is temporarily banned (Edge-safe: Upstash REST or in-memory).
 */
export async function isBlocked(ip: string | undefined): Promise<boolean> {
  const k = ipKey(ip ?? '')
  if (!k) return false

  const redis = getRedis()
  if (redis) {
    const banned = await redis.exists(`${PREFIX_BAN}${k}`)
    return banned === 1
  }

  memPruneIfNeeded()
  return memIsBlocked(k)
}

/**
 * Record a failed auth outcome (401/403) or repeated rate-limit hit (429). At {@link FAILURE_THRESHOLD}
 * failures, sets a ban for {@link BAN_SECONDS} seconds.
 */
export async function recordFailure(ip: string | undefined): Promise<void> {
  const k = ipKey(ip ?? '')
  if (!k) return

  const redis = getRedis()
  if (redis) {
    const banKey = `${PREFIX_BAN}${k}`
    if ((await redis.exists(banKey)) === 1) return

    const failKey = `${PREFIX_FAILURES}${k}`
    const n = await redis.incr(failKey)
    if (n === 1) {
      await redis.expire(failKey, BAN_SECONDS * 2)
    }
    if (n >= FAILURE_THRESHOLD) {
      await redis.set(banKey, '1', { ex: BAN_SECONDS })
      await redis.del(failKey)
      void import('@/lib/security/securityIpNotifications').then((m) =>
        m.notifyIpBanFromRepeatedFailures(ip),
      )
    }
    return
  }

  memPruneIfNeeded()
  let e = memStore.get(k)
  if (!e) {
    e = { failures: 0, banUntil: null }
    memStore.set(k, e)
  }
  if (e.banUntil !== null && Date.now() < e.banUntil) return

  e.failures += 1
  if (e.failures >= FAILURE_THRESHOLD) {
    e.banUntil = Date.now() + BAN_SECONDS * 1000
    e.failures = 0
    void import('@/lib/security/securityIpNotifications').then((m) =>
      m.notifyIpBanFromRepeatedFailures(ip),
    )
  }
}

/**
 * Clear failure count and any active ban (e.g. after successful login).
 */
export async function resetFailures(ip: string | undefined): Promise<void> {
  const k = ipKey(ip ?? '')
  if (!k) return

  const redis = getRedis()
  if (redis) {
    await Promise.all([redis.del(`${PREFIX_FAILURES}${k}`), redis.del(`${PREFIX_BAN}${k}`)])
    return
  }

  memStore.delete(k)
}
