import type { NextRequest } from 'next/server'

/**
 * Lightweight heuristics — enable strict blocking only after verifying clients send User-Agent.
 * Set RELAX_BOT_CHECKS=1 to disable (e.g. local scripts).
 */
export function isSuspiciousApiRequest(request: NextRequest, pathname: string): boolean {
  if (process.env.RELAX_BOT_CHECKS === '1') return false
  if (!pathname.startsWith('/api')) return false
  if (request.method === 'OPTIONS' || request.method === 'HEAD') return false
  if (pathname.startsWith('/api/cron/')) return false

  const raw = request.headers.get('user-agent')
  const ua = raw?.trim() ?? ''
  if (ua.length === 0) return true
  return false
}
