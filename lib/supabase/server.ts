import { cookies } from 'next/headers'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'

/**
 * Server-side Supabase client for Next.js App Router
 * 
 * USAGE:
 * - Only use in Server Components
 * - Reads session from cookies (safe)
 * - Do NOT write/modify cookies here (use Route Handlers instead)
 * 
 * Example:
 * const supabase = await createServerClient()
 * const { data: { user } } = await supabase.auth.getUser()
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // This is safe to ignore in Server Components
            // Cookies should only be set via Route Handlers or Server Actions
          }
        },
      },
    }
  )
}

export async function createClient() {
  return createServerClient()
}
