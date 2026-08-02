/**
 * Mint a bearer token for the hosted PVC calculator MCP server (app/api/mcp).
 * Prints the plaintext token ONCE — only the bcrypt hash is stored in Supabase.
 *
 * Required env (or set in `.env.local`):
 * - SUPABASE_URL **or** NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/mcp/generateApiToken.ts "Prasanna"
 */

import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const SALT_ROUNDS = 12

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`[mcp-token] Missing required environment variable: ${name}`)
    process.exit(2)
  }
  return value
}

async function main() {
  const label = process.argv[2]?.trim()
  if (!label) {
    console.error('[mcp-token] Usage: npx tsx scripts/mcp/generateApiToken.ts "<person name>"')
    process.exit(1)
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl) {
    console.error('[mcp-token] Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
    process.exit(2)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const token = `nbe_mcp_${randomBytes(24).toString('base64url')}`
  const tokenHash = bcrypt.hashSync(token, SALT_ROUNDS)

  const { error } = await supabase.from('mcp_api_tokens').insert({ label, token_hash: tokenHash })
  if (error) {
    console.error('[mcp-token] Failed to store token:', error.message)
    process.exit(1)
  }

  console.log(`\n[mcp-token] Token created for "${label}". Save this now — it will not be shown again:\n`)
  console.log(token)
  console.log()
}

main().catch(error => {
  console.error('[mcp-token] Fatal error:', error)
  process.exit(1)
})
