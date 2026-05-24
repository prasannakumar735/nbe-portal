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

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear' | 'key'>

function createSafeStorage(): StorageLike {
  const memory = new Map<string, string>()
  const read = (storage: Storage | undefined, key: string): string | null => {
    try {
      return storage?.getItem(key) ?? memory.get(key) ?? null
    } catch {
      return memory.get(key) ?? null
    }
  }

  const write = (storage: Storage | undefined, key: string, value: string) => {
    try {
      storage?.setItem(key, value)
    } catch {
      memory.set(key, value)
    }
  }

  const remove = (storage: Storage | undefined, key: string) => {
    try {
      storage?.removeItem(key)
    } catch {
      memory.delete(key)
    }
    memory.delete(key)
  }

  const clear = (storage: Storage | undefined) => {
    try {
      storage?.clear()
    } catch {
      // ignore
    }
    memory.clear()
  }

  return {
    getItem(key: string) {
      return read(typeof window !== 'undefined' ? window.localStorage : undefined, key)
    },
    setItem(key: string, value: string) {
      write(typeof window !== 'undefined' ? window.localStorage : undefined, key, value)
    },
    removeItem(key: string) {
      remove(typeof window !== 'undefined' ? window.localStorage : undefined, key)
    },
    clear() {
      clear(typeof window !== 'undefined' ? window.localStorage : undefined)
    },
    key(index: number) {
      try {
        return typeof window !== 'undefined' ? window.localStorage.key(index) : null
      } catch {
        return Array.from(memory.keys())[index] ?? null
      }
    },
  }
}

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
        storage: createSafeStorage(),
      },
    }
  )

  return supabaseClient
}
