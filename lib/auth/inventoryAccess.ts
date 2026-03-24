import { createServerClient } from '@/lib/supabase/server'
import { canAccessInventoryByRole, getUserRole } from '@/lib/auth/userRole'

export async function requireInventoryAccess() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { authorized: false as const, status: 401, error: 'Unauthorized' }
  }

  const role = await getUserRole(user.id)
  if (!canAccessInventoryByRole(role)) {
    return { authorized: false as const, status: 403, error: 'Forbidden. Admin or manager only.' }
  }

  return {
    authorized: true as const,
    user,
    role,
  }
}
