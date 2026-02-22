/**
 * Server-side auth utilities for Next.js App Router
 * 
 * Use these functions in Server Components to check authentication
 * WITHOUT causing render loops or hydration mismatches
 */

import { createServerClient } from '../supabase/server'

/**
 * Get the current user session on the server
 * Safe to use in Server Components
 * 
 * Returns null if not authenticated
 */
export async function getServerSession() {
  try {
    const supabase = await createServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session
  } catch (error) {
    console.error('Error getting server session:', error)
    return null
  }
}

/**
 * Check if user is authenticated on the server
 * Returns boolean for simple auth checks
 */
export async function isServerAuthenticated(): Promise<boolean> {
  const session = await getServerSession()
  return !!session
}

/**
 * Get current user on the server
 * Safe to use in Server Components
 * 
 * Returns null if not authenticated
 */
export async function getServerUser() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    return user
  } catch (error) {
    console.error('Error getting server user:', error)
    return null
  }
}
