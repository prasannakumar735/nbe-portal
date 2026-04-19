/**
 * Verify Supabase connectivity and backup-related readiness (read-only).
 *
 * Required env (or set in `.env.local`):
 * - SUPABASE_URL **or** NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Uses RPC `nbe_backup_health_ping()` (migration `056_nbe_backup_health_ping.sql`) for `SELECT NOW()`.
 * If the RPC is missing, falls back to a minimal `profiles` probe.
 *
 * Usage:
 *   npm run backup:check
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) {
    console.error(`[backup-check] Missing required environment variable: ${name}`)
    process.exit(2)
  }
  return v
}

async function main() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  if (!url) {
    console.error(
      '[backup-check] Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (project API URL, e.g. https://xxx.supabase.co)',
    )
    process.exit(2)
  }

  console.log('[backup-check] database_url_host:', new URL(url).host)

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Migration `056_nbe_backup_health_ping.sql`
  const { data, error } = await supabase.rpc('nbe_backup_health_ping')
  if (!error && data != null) {
    console.log('[backup-check] database_reachable: true')
    console.log('[backup-check] server_timestamp:', String(data))
    console.log('[backup-check] ok')
    process.exit(0)
  }

  console.warn('[backup-check] RPC nbe_backup_health_ping unavailable:', error?.message ?? 'unknown')
  console.warn('[backup-check] Applying fallback probe: profiles (limit 1)')

  const fb = await supabase.from('profiles').select('id').limit(1)
  if (fb.error) {
    console.error('[backup-check] database_reachable: false', fb.error.message)
    process.exit(1)
  }

  console.log('[backup-check] database_reachable: true (fallback; apply migration 056 for exact NOW())')
  console.log('[backup-check] check_completed_at:', new Date().toISOString())
  console.log('[backup-check] ok')
  process.exit(0)
}

main().catch((e) => {
  console.error('[backup-check] fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
