'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { ProfileFromTable } from '@/lib/auth/roles'
import { isAdmin as checkIsAdmin, isEmployee as checkIsEmployee, isManager as checkIsManager } from '@/lib/auth/roles'

/**
 * Profile loaded from profiles table (single source of truth for roles).
 * Do NOT introduce new role tables; always use profiles.role.
 */
export type AuthProfile = ProfileFromTable

/**
 * Auth Context - Provides session and profile (role) to entire app
 *
 * - session, user: from Supabase Auth
 * - profile: from profiles table (role, first_name, last_name)
 * - isAdmin, isManager, isEmployee: derived from profile.role
 */

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: AuthProfile | null
  isAdmin: boolean
  isManager: boolean
  isEmployee: boolean
  isLoading: boolean
  isError: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Hook to use auth context in any component
 * Throws error if used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

type AuthProviderProps = {
  children: ReactNode
}

/**
 * AuthProvider - Global Authentication Context
 * 
 * This component:
 * 1. Initializes Supabase client (singleton)
 * 2. Checks for existing session on mount
 * 3. Subscribes to auth state changes globally
 * 4. Provides session state to all child components
 * 5. Handles session persistence across page refreshes
 * 
 * CRITICAL:
 * - Must wrap entire app in layout.tsx
 * - Subscription handles all auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
 * - Only redirects happen in RouteGuard, not here
 * - Session state is used by RouteGuard to protect routes
 * 
 * PRODUCTION FIX:
 * - No hardcoded .env.local checks
 * - Environment variables validated at build time
 * - Singleton client prevents GoTrueClient warnings
 */

async function fetchProfile(supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<AuthProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('role, full_name, first_name, last_name, client_id, phone, is_active')
    .eq('id', userId)
    .single()
  return data as AuthProfile | null
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  // Load profile from profiles table when user changes (single source of truth for role)
  useEffect(() => {
    if (!user?.id) {
      setProfile(null)
      return
    }
    let cancelled = false
    const supabase = createSupabaseClient()
    fetchProfile(supabase, user.id).then(async (p) => {
      if (cancelled) return
      if (p && p.is_active === false) {
        await supabase.auth.signOut()
        setProfile(null)
        return
      }
      setProfile(p)
    })
    return () => { cancelled = true }
  }, [user?.id])

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const supabase = createSupabaseClient()

        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          setIsError(true)
        } else {
          setSession(initialSession)
          setUser(initialSession?.user || null)
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        setIsError(true)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  // Subscribe to auth state changes
  useEffect(() => {
    const supabase = createSupabaseClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user || null)
      setIsLoading(false)

      if (process.env.NODE_ENV === 'development') {
        console.log('Auth event:', event, '| User:', newSession?.user?.email)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const value: AuthContextType = {
    session,
    user,
    profile,
    isAdmin: checkIsAdmin(profile),
    isManager: checkIsManager(profile),
    isEmployee: checkIsEmployee(profile),
    isLoading,
    isError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
