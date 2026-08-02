import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Opaque, high-entropy tokens hashed with SHA-256 for O(1) lookup (not bcrypt — these
 *  aren't passwords, and every /api/mcp request needs a fast indexed lookup, not a
 *  deliberately slow one). */
export function generateOpaqueToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateAuthorizationCode(): string {
  return randomBytes(32).toString('base64url')
}

const AUTH_CODE_TTL_MS = 5 * 60 * 1000
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type IssuedTokenPair = {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
}

export async function storeAuthorizationCode(
  supabase: SupabaseClient,
  params: {
    code: string
    clientId: string
    userId: string
    redirectUri: string
    codeChallenge: string
    codeChallengeMethod: string
    scope?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from('oauth_authorization_codes').insert({
    code_hash: hashToken(params.code),
    client_id: params.clientId,
    user_id: params.userId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    scope: params.scope ?? null,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString(),
  })
  if (error) throw error
}

export async function issueTokenPair(
  supabase: SupabaseClient,
  params: { clientId: string; userId: string; scope?: string | null },
): Promise<IssuedTokenPair> {
  const accessToken = generateOpaqueToken('nbe_oauth_at')
  const refreshToken = generateOpaqueToken('nbe_oauth_rt')

  const { error: accessError } = await supabase.from('oauth_access_tokens').insert({
    token_hash: hashToken(accessToken),
    client_id: params.clientId,
    user_id: params.userId,
    scope: params.scope ?? null,
    expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString(),
  })
  if (accessError) throw accessError

  const { error: refreshError } = await supabase.from('oauth_refresh_tokens').insert({
    token_hash: hashToken(refreshToken),
    client_id: params.clientId,
    user_id: params.userId,
    scope: params.scope ?? null,
    expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
  })
  if (refreshError) throw refreshError

  return { accessToken, refreshToken, expiresInSeconds: ACCESS_TOKEN_TTL_MS / 1000 }
}

export { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS }
