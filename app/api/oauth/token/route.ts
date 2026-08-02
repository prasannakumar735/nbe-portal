import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { verifyPkce } from '@/lib/oauth/pkce'
import { hashToken, issueTokenPair } from '@/lib/oauth/tokens'

type OAuthClientRow = {
  client_id: string
  client_secret_hash: string | null
  token_endpoint_auth_method: string
}

type AuthCodeRow = {
  client_id: string
  user_id: string
  redirect_uri: string
  code_challenge: string
  code_challenge_method: string
  scope: string | null
  expires_at: string
  used_at: string | null
}

type RefreshTokenRow = {
  client_id: string
  user_id: string
  scope: string | null
  expires_at: string
  revoked_at: string | null
}

function tokenError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status })
}

async function parseBody(request: NextRequest): Promise<URLSearchParams> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const json = (await request.json()) as Record<string, string>
    return new URLSearchParams(json)
  }
  const text = await request.text()
  return new URLSearchParams(text)
}

async function loadClient(supabase: ReturnType<typeof createServiceRoleClient>, clientId: string) {
  const { data } = await supabase
    .from('oauth_clients')
    .select('client_id, client_secret_hash, token_endpoint_auth_method')
    .eq('client_id', clientId)
    .maybeSingle()
  return (data as OAuthClientRow | null) ?? null
}

function verifyClientSecret(client: OAuthClientRow, providedSecret: string | null): boolean {
  if (client.token_endpoint_auth_method !== 'client_secret_post') return true
  if (!client.client_secret_hash || !providedSecret) return false
  return hashToken(providedSecret) === client.client_secret_hash
}

async function handleAuthorizationCodeGrant(body: URLSearchParams) {
  const code = body.get('code')
  const redirectUri = body.get('redirect_uri')
  const clientId = body.get('client_id')
  const codeVerifier = body.get('code_verifier')
  const clientSecret = body.get('client_secret')

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return tokenError('invalid_request', 'code, redirect_uri, client_id, and code_verifier are required.')
  }

  const supabase = createServiceRoleClient()
  const client = await loadClient(supabase, clientId)
  if (!client) return tokenError('invalid_client', 'Unknown client_id.', 401)
  if (!verifyClientSecret(client, clientSecret)) return tokenError('invalid_client', 'Invalid client_secret.', 401)

  const codeHash = hashToken(code)
  const { data: authCode } = await supabase
    .from('oauth_authorization_codes')
    .select('client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, expires_at, used_at')
    .eq('code_hash', codeHash)
    .maybeSingle()

  const row = authCode as AuthCodeRow | null
  if (!row) return tokenError('invalid_grant', 'Unknown or expired authorization code.')
  if (row.used_at) return tokenError('invalid_grant', 'Authorization code already used.')
  if (new Date(row.expires_at).getTime() < Date.now()) return tokenError('invalid_grant', 'Authorization code expired.')
  if (row.client_id !== clientId) return tokenError('invalid_grant', 'client_id mismatch.')
  if (row.redirect_uri !== redirectUri) return tokenError('invalid_grant', 'redirect_uri mismatch.')
  if (!verifyPkce(codeVerifier, row.code_challenge)) return tokenError('invalid_grant', 'PKCE verification failed.')

  await supabase.from('oauth_authorization_codes').update({ used_at: new Date().toISOString() }).eq('code_hash', codeHash)

  const tokens = await issueTokenPair(supabase, { clientId, userId: row.user_id, scope: row.scope })

  return NextResponse.json({
    access_token: tokens.accessToken,
    token_type: 'Bearer',
    expires_in: tokens.expiresInSeconds,
    refresh_token: tokens.refreshToken,
    scope: row.scope ?? undefined,
  })
}

async function handleRefreshTokenGrant(body: URLSearchParams) {
  const refreshToken = body.get('refresh_token')
  const clientId = body.get('client_id')
  const clientSecret = body.get('client_secret')

  if (!refreshToken || !clientId) {
    return tokenError('invalid_request', 'refresh_token and client_id are required.')
  }

  const supabase = createServiceRoleClient()
  const client = await loadClient(supabase, clientId)
  if (!client) return tokenError('invalid_client', 'Unknown client_id.', 401)
  if (!verifyClientSecret(client, clientSecret)) return tokenError('invalid_client', 'Invalid client_secret.', 401)

  const tokenHash = hashToken(refreshToken)
  const { data: existing } = await supabase
    .from('oauth_refresh_tokens')
    .select('client_id, user_id, scope, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  const row = existing as RefreshTokenRow | null
  if (!row) return tokenError('invalid_grant', 'Unknown refresh token.')
  if (row.revoked_at) return tokenError('invalid_grant', 'Refresh token has been revoked.')
  if (new Date(row.expires_at).getTime() < Date.now()) return tokenError('invalid_grant', 'Refresh token expired.')
  if (row.client_id !== clientId) return tokenError('invalid_grant', 'client_id mismatch.')

  const tokens = await issueTokenPair(supabase, { clientId, userId: row.user_id, scope: row.scope })

  await supabase
    .from('oauth_refresh_tokens')
    .update({ revoked_at: new Date().toISOString(), replaced_by: hashToken(tokens.refreshToken) })
    .eq('token_hash', tokenHash)

  return NextResponse.json({
    access_token: tokens.accessToken,
    token_type: 'Bearer',
    expires_in: tokens.expiresInSeconds,
    refresh_token: tokens.refreshToken,
    scope: row.scope ?? undefined,
  })
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  const grantType = body.get('grant_type')

  if (grantType === 'authorization_code') return handleAuthorizationCodeGrant(body)
  if (grantType === 'refresh_token') return handleRefreshTokenGrant(body)

  return tokenError('unsupported_grant_type', 'grant_type must be authorization_code or refresh_token.')
}
