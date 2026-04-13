import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { createServerClient } from '@/lib/supabase/server'
import { isManagerOrAdminRole } from '@/lib/auth/roles'

/**
 * Server-only guard for /manager/* routes. Redirects employees/technicians to the portal dashboard.
 */
export async function requireManagerOrAdminRoute(): Promise<void> {
  const user = await getServerUser()
  if (!user) {
    redirect('/login')
  }

  const supabase = await createServerClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile as { role?: string } | null)?.role
  if (!isManagerOrAdminRole(role)) {
    redirect('/dashboard')
  }
}
