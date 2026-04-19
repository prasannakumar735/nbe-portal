import { createServerClient } from '@/lib/supabase/server'
import { isClientRole } from '@/lib/auth/roles'

import { ForbiddenError } from './errors'
import { requireUserProfile } from './requireUserProfile'

/**
 * Authenticated portal user who is not a `client` org user (quotes, internal tools).
 * Authorization: JWT + profiles.role (not request-supplied identity).
 */
export async function requirePortalStaff() {
  const supabase = await createServerClient()
  const { user, profile } = await requireUserProfile(supabase)
  if (profile.is_active === false) {
    throw new ForbiddenError('Forbidden')
  }
  if (isClientRole(profile)) {
    throw new ForbiddenError('Forbidden')
  }
  return { supabase, user, profile }
}
