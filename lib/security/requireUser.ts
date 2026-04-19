import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import { UnauthorizedError } from './errors'

export { UnauthorizedError } from './errors'

/**
 * Server-side: require a valid Supabase session (JWT validated by Supabase).
 * Use with `createServerClient()` — never trust `user` from request body.
 */
export async function requireUser(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new UnauthorizedError('Unauthorized')
  }
  return user
}
