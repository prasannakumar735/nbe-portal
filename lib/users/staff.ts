import { createServerClient } from '@/lib/supabase/server'

export async function requireManagerOrAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, error: 'Not authenticated' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return { ok: false, error: 'Profile not found' }
  }

  if (profile.is_active === false) {
    return { ok: false, error: 'Account is inactive' }
  }

  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return { ok: false, error: 'You do not have permission to manage users' }
  }

  return { ok: true, userId: user.id }
}
