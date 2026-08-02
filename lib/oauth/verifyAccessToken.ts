import type { SupabaseClient } from '@supabase/supabase-js'
import { hashToken } from './tokens'

type AccessTokenRow = {
  user_id: string
  client_id: string
  expires_at: string
}

export type OAuthAuthResult = { userId: string; clientId: string }

export async function verifyOAuthAccessToken(
  supabase: SupabaseClient,
  token: string,
): Promise<OAuthAuthResult | null> {
  if (!token) return null

  const tokenHash = hashToken(token)
  const { data } = await supabase
    .from('oauth_access_tokens')
    .select('user_id, client_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  const row = data as AccessTokenRow | null
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) return null

  await supabase
    .from('oauth_access_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)

  return { userId: row.user_id, clientId: row.client_id }
}
