'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase Client
 * 
 * USAGE:
 * - Only use in client components ('use client')
 * - Safe for browser environment
 * - Handles session persistence automatically
 * - Manages token refresh internally
 * 
 * NOT for server components - use lib/supabase/server.ts instead
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        debug: process.env.NODE_ENV === 'development',
      },
    }
  )
}
