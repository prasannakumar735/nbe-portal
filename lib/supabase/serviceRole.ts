import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Server-only: supports `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` (CI / some hosts). */
export function getSupabaseUrlForServer(): string {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim()
  return url
}

/** Anon key client for Auth methods that must not use the service role (e.g. `resetPasswordForEmail`). */
export function createAnonServerClient(): SupabaseClient {
  const url = getSupabaseUrlForServer()
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (or URL) for anon auth operations.')
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * **Bypasses RLS.** Use only in trusted server code after authenticating/authorizing the caller
 * (`requireUser`, `requireUserProfile`, `requirePortalStaff`, `requireManagerOrAdminApi`, `CRON_SECRET`, or
 * validated public resource lookups — see `lib/security/publicContactSlug.ts` / SECURITY.md).
 */
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
