'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createSupabaseClient } from '@/lib/supabase/client'

/**
 * Auth Context - Provides session state to entire app
 * 
 * This context stores:
 * - session: Current user session (or null if logged out)
 * - user: Current user data (or null if logged out)
 * - isLoading: Whether auth state is being checked
 * - isError: Whether an error occurred during auth check
 */

type AuthContextType = {
  session: Session | null
  user: User | null
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const supabase = createSupabaseClient()

        // Check for existing session
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
      // Update context with new session
      setSession(newSession)
      setUser(newSession?.user || null)
      setIsLoading(false)

      if (process.env.NODE_ENV === 'development') {
        console.log('Auth event:', event, '| User:', newSession?.user?.email)
      }
    })

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const value: AuthContextType = {
    session,
    user,
    isLoading,
    isError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
