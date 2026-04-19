/**
 * Stale cookies / local storage can hold an access token while the refresh token
 * is missing or revoked — Supabase then throws AuthApiError ("Invalid Refresh Token").
 * Clearing the session fixes the broken state; user can sign in again.
 */
export function isInvalidOrMissingRefreshTokenError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  const e = error as { message?: string; name?: string; code?: string }
  const msg = String(e.message ?? '').toLowerCase()
  const code = String(e.code ?? '').toLowerCase()
  return (
    code === 'refresh_token_not_found'
    || code === 'invalid_refresh_token'
    || (e.name === 'AuthApiError' && msg.includes('refresh token'))
    || msg.includes('refresh token not found')
  )
}
