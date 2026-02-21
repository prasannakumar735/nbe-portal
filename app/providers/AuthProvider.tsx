'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'

type AuthProviderProps = {
  children: ReactNode
}

/**
 * AuthProvider: Global auth state listener
 * 
 * Listens for auth state changes and triggers:
 * - router.refresh() on SIGNED_IN to sync server state
 * - router.push('/login') on SIGNED_OUT to redirect
 * 
 * Must be wrapped around layout children to work globally.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter()

  useEffect(() => {
    try {
      const supabase = getSupabaseClient()

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // User just signed in, refresh to sync server state
          router.refresh()
        } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
          // User signed out or session expired, redirect to login
          router.push('/login')
        }
      })

      return () => {
        subscription?.unsubscribe()
      }
    } catch (error) {
      console.error('Error setting up auth listener:', error)
    }
  }, [router])

  return <>{children}</>
}
