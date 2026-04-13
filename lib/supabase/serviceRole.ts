import { createClient } from '@supabase/supabase-js'

/** Server-only: supports `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` (CI / some hosts). */
export function getSupabaseUrlForServer(): string {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim()
  return url
}

export function createServiceRoleClient() {
  const url = getSupabaseUrlForServer()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

  if (!url || !key) {
    throw new Error('Missing Supabase service role configuration (URL or SUPABASE_SERVICE_ROLE_KEY).')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
