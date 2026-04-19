import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

import { ForbiddenError } from './errors'
import { requireUser } from './requireUser'

export type SessionProfileRow = {
  id: string
  role: string | null
  is_active: boolean | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  client_id: string | null
}

/**
 * Validated session user plus `profiles` row (never trust `user_id` or role from request input).
 */
export async function requireUserProfile(supabase: SupabaseClient): Promise<{
  user: User
  profile: SessionProfileRow
}> {
  const user = await requireUser(supabase)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, is_active, full_name, first_name, last_name, phone, client_id')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !profile?.id) {
    throw new ForbiddenError('Forbidden')
  }

  return {
    user,
    profile: profile as SessionProfileRow,
  }
}
