import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isManagerOrAdminRole } from '@/lib/auth/roles'

type AuthResult =
  | { ok: true; userId: string; role: string; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

export async function requireManagerOrAdminApi(): Promise<AuthResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = String((profile as { role?: string } | null)?.role ?? '').trim()
  if (!isManagerOrAdminRole(role)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, userId: user.id, role, supabase: createServiceRoleClient() }
}

export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

export function fail(error: string, status = 400, issues?: unknown) {
  return NextResponse.json({ ok: false, error, issues }, { status })
}
