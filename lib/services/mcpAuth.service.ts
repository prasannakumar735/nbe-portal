import type { SupabaseClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

type McpTokenRow = {
  id: string
  label: string
  token_hash: string
}

export type McpAuthResult = {
  id: string
  label: string
}

/**
 * Checks a bearer token against all active (non-revoked) hashed tokens.
 * Table is small (per-person tokens for an internal tool), so a linear
 * bcrypt.compare scan is fine — hashes can't be looked up by value.
 */
export async function verifyMcpToken(
  supabase: SupabaseClient,
  token: string,
): Promise<McpAuthResult | null> {
  if (!token) return null

  const { data, error } = await supabase
    .from('mcp_api_tokens')
    .select('id, label, token_hash')
    .is('revoked_at', null)

  if (error) throw error

  const rows = (data || []) as McpTokenRow[]
  const match = rows.find(row => bcrypt.compareSync(token, row.token_hash))

  if (!match) return null

  await supabase
    .from('mcp_api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', match.id)

  return { id: match.id, label: match.label }
}
