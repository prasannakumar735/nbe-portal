/**
 * Best-effort in-memory rate limiting for Edge middleware.
 * On Vercel, each isolate has its own map (not global across regions/instances).
 * For distributed enforcement, use Upstash / Vercel KV and @upstash/ratelimit.
 */

type WindowEntry = {
  count: number
  windowStart: number
}

const store = new Map<string, WindowEntry>()
const MAX_ENTRIES = 20_000

function pruneIfNeeded() {
  if (store.size <= MAX_ENTRIES) return
  const cutoff = Date.now() - 120_000
  for (const [k, v] of store) {
    if (v.windowStart < cutoff) store.delete(k)
  }
}

/**
 * @returns true if request is allowed, false if rate limited
 */
export function checkSlidingWindow(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  pruneIfNeeded()
  const now = Date.now()
  const e = store.get(key)
  if (!e || now - e.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return true
  }
  if (e.count >= maxRequests) return false
  e.count += 1
  return true
}

/** Prefer first hop in X-Forwarded-For (Vercel / proxies). */
export function getClientIp(request: { headers: Headers }): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}
