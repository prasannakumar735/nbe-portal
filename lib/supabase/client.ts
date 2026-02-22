'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * SINGLETON Supabase Browser Client
 * 
 * CRITICAL: This is a singleton to prevent multiple GoTrueClient instances.
 * Do NOT create new instances in components.
 * 
 * USAGE:
 * const supabase = createSupabaseClient()
 * 
 * Features:
 * - Lazy initialization (only created when first called)
 * - Session persistence enabled
 * - Auto token refresh enabled
 * - PKCE flow for security
 * - Works with AuthProvider for global state
 */

let supabaseClient: SupabaseClient | null = null

export function createSupabaseClient() {
  // Return existing instance if already created
  if (supabaseClient) {
    return supabaseClient
  }

  // Create new instance only once
  supabaseClient = createBrowserClient(
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

  return supabaseClient
}
