/**
 * Bump `NEXT_PUBLIC_APP_SESSION_EPOCH` on each production deploy when you want every browser
 * to sign out once and re-authenticate (new value = stale session).
 */
const LS_KEY = 'nbe_app_session_epoch'

export function getExpectedAppSessionEpoch(): string {
  return (process.env.NEXT_PUBLIC_APP_SESSION_EPOCH ?? '').trim()
}

/**
 * If the stored epoch does not match the build, sign out so Supabase cookies are cleared.
 * Call once on the client before relying on `getSession()`.
 */
export async function enforceAppSessionEpochSignOut(signOut: () => Promise<unknown>): Promise<void> {
  if (typeof window === 'undefined') return
  const expected = getExpectedAppSessionEpoch()
  if (!expected) return

  let stored = ''
  try {
    stored = window.localStorage.getItem(LS_KEY) ?? ''
  } catch {
    return
  }
  if (stored === expected) return

  try {
    await signOut()
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(LS_KEY, expected)
  } catch {
    /* ignore */
  }
}
