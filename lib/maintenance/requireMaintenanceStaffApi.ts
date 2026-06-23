import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isClientRole, type ProfileFromTable } from '@/lib/auth/roles'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

type AuthResult =
  | { ok: true; userId: string; role: string; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

/** Signed-in portal staff (not client role). Returns service role client for writes. */
export async function requireMaintenanceStaffApi(): Promise<AuthResult> {
  const session = await createServerClient()
  const {
    data: { user },
  } = await session.auth.getUser()

  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await session
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (isClientRole(profile as ProfileFromTable | null)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    userId: user.id,
    role: String((profile as { role?: string } | null)?.role ?? '').trim(),
    supabase: createServiceRoleClient(),
  }
}
