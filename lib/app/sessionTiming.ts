/**
 * Portal session wall-clock + idle limits (tuned via NEXT_PUBLIC_* env at build time).
 * `nbe_login_at` in sessionStorage backs absolute max session length.
 */
export const LOGIN_AT_SESSION_KEY = 'nbe_login_at'

export type SessionTimingConfig = {
  idleTimeoutMs: number
  idleDisabled: boolean
  sessionMaxMs: number
  maxDisabled: boolean
  idleWarningBeforeMs: number
  trackMousemove: boolean
}

function parseMsEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

/** Read once per module load; NEXT_PUBLIC_* inlined at build. */
export function getSessionTimingConfig(): SessionTimingConfig {
  const idleParsed = parseMsEnv(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS, 15 * 60 * 1000)
  const idleDisabled = process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS === '0'

  const maxParsed = parseMsEnv(process.env.NEXT_PUBLIC_SESSION_MAX_MS, 8 * 60 * 60 * 1000)
  const maxDisabled = process.env.NEXT_PUBLIC_SESSION_MAX_MS === '0'

  const idleWarningBeforeMs = Math.max(
    10_000,
    parseMsEnv(process.env.NEXT_PUBLIC_IDLE_WARNING_BEFORE_MS, 2 * 60 * 1000),
  )

  const trackMousemove =
    process.env.NEXT_PUBLIC_IDLE_TRACK_MOUSEMOVE !== '0' &&
    process.env.NEXT_PUBLIC_IDLE_TRACK_MOUSEMOVE !== 'false'

  const idleTimeoutMs = idleDisabled ? 0 : idleParsed > 0 ? idleParsed : 15 * 60 * 1000
  const sessionMaxMs = maxDisabled ? 0 : maxParsed > 0 ? maxParsed : 8 * 60 * 60 * 1000

  return {
    idleTimeoutMs,
    idleDisabled,
    sessionMaxMs,
    maxDisabled,
    idleWarningBeforeMs,
    trackMousemove,
  }
}

export function getLoginAtMs(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(LOGIN_AT_SESSION_KEY)
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function setLoginAtNow(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(LOGIN_AT_SESSION_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export function loginRedirectPath(pathname: string): string {
  if (pathname.startsWith('/client') && !pathname.startsWith('/client/login')) {
    return '/client/login'
  }
  return '/login'
}
