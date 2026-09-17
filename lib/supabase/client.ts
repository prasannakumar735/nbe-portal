'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Custom lock function that wraps navigator.locks.request.
 *
 * The GoTrueClient fires an uncaught async IIFE for each onAuthStateChange
 * registration. That IIFE calls navigator.locks.request to queue a lock
 * acquisition. When window.location.assign fires (page unload), the browser
 * cancels all pending (queued, not yet granted) lock requests with AbortError.
 * Because the IIFE has no .catch(), these become unhandled rejections that the
 * Next.js dev overlay surfaces as blocking errors.
 *
 * We catch AbortError ONLY from the acquisition phase (when `fn` was never
 * called — the lock was never granted). AbortErrors thrown from inside `fn`
 * (i.e. after the lock is held) still propagate so real auth errors surface.
 */
async function safeNavigatorLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return await fn()
  }

  if (acquireTimeout === 0) {
    return await navigator.locks.request(
      name,
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock) return null as unknown as R
        return await fn()
      },
    )
  }

  const ac = acquireTimeout > 0 ? new AbortController() : null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  if (ac && acquireTimeout > 0) timeoutId = setTimeout(() => ac!.abort(), acquireTimeout)

  let lockEntered = false
  try {
    return await navigator.locks.request(
      name,
      { mode: 'exclusive', ...(ac ? { signal: ac.signal } : {}) },
      async () => {
        lockEntered = true
        return await fn()
      },
    )
  } catch (err) {
    // AbortError before fn ran = browser cancelled the queued lock request
    // (page navigation/unload). The lock was never held; returning undefined
    // is safe and prevents unhandled rejections in the Next.js dev overlay.
    if (!lockEntered && err instanceof DOMException && err.name === 'AbortError') {
      return undefined as unknown as R
    }
    throw err
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId)
  }
}

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
        lock: safeNavigatorLock,
      },
    }
  )

  return supabaseClient
}
