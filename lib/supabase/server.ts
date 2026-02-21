import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Server-side Supabase client for Next.js App Router
 * 
 * IMPORTANT: This client is READ-ONLY for cookies.
 * Cookie modifications are only allowed in Server Actions or Route Handlers.
 * 
 * Use this for:
 * - Reading authenticated user session data
 * - Making queries on behalf of the user
 * - Accessing protected data in Server Components
 * 
 * DO NOT use this for:
 * - Setting/modifying cookies (they must go through Server Actions)
 * - Login/logout (use client-side auth)
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    {
      cookies: {
        get(name) {
          try {
            return cookieStore.get(name)?.value
          } catch (error) {
            console.error(`Error reading cookie ${name}:`, error)
            return undefined
          }
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Cookies can only be set in Server Actions or Route Handlers
            // This is expected and safe to ignore during Server Component render
            if (process.env.NODE_ENV === 'development') {
              console.debug(`Cookie set attempted in Server Component: ${name} (this is expected)`)
            }
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Cookies can only be removed in Server Actions or Route Handlers
            // This is expected and safe to ignore during Server Component render
            if (process.env.NODE_ENV === 'development') {
              console.debug(`Cookie remove attempted in Server Component: ${name} (this is expected)`)
            }
          }
        }
      }
    }
  )
}
