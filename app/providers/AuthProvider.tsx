'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { enforceAppSessionEpochSignOut } from '@/lib/app/sessionEpoch'
import {
  getLoginAtMs,
  getSessionTimingConfig,
  loginRedirectPath,
  setLoginAtNow,
  LOGIN_AT_SESSION_KEY,
} from '@/lib/app/sessionTiming'
import { createSupabaseClient } from '@/lib/supabase/client'
import { isInvalidOrMissingRefreshTokenError } from '@/lib/supabase/authSessionErrors'
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

const MOUSEMOVE_THROTTLE_MS = 30_000
const MAX_SESSION_CHECK_MS = 60_000
/** Poll interval to detect App Router navigations without `usePathname()` (avoids Next dev OuterLayoutRouter / NavigationPromises races at the root). */
const PATHNAME_POLL_MS = 200

/**
 * Idle / max session timers + warning modal. Inlined here so the root layout only imports
 * AuthProvider (avoids RSC client-reference + circular AuthProvider ↔ SessionLifecycle issues).
 */
function SessionLifecycle() {
  const { session, isLoading } = useAuth()
  const [showIdleWarning, setShowIdleWarning] = useState(false)

  const configRef = useRef(getSessionTimingConfig())
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleLogoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMousemoveRef = useRef(0)
  const maxIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPathPollRef = useRef('')

  const clearIdleTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (idleLogoutTimerRef.current) {
      clearTimeout(idleLogoutTimerRef.current)
      idleLogoutTimerRef.current = null
    }
  }, [])

  const signOutAndRedirect = useCallback(async (_reason: 'idle' | 'max') => {
    clearIdleTimers()
    setShowIdleWarning(false)
    const path = typeof window !== 'undefined' ? window.location.pathname : '/'
    const target = loginRedirectPath(path)
    try {
      const supabase = createSupabaseClient()
      await supabase.auth.signOut()
    } catch {
      /* still redirect */
    }
    try {
      sessionStorage.removeItem(LOGIN_AT_SESSION_KEY)
    } catch {
      /* ignore */
    }
    window.location.assign(target)
  }, [clearIdleTimers])

  const scheduleIdleTimers = useCallback(() => {
    const cfg = configRef.current
    clearIdleTimers()
    if (cfg.idleDisabled || cfg.idleTimeoutMs <= 0) return

    const safeLead = Math.min(
      cfg.idleWarningBeforeMs,
      Math.max(0, cfg.idleTimeoutMs - 10_000),
    )
    const warningDelay = Math.max(0, cfg.idleTimeoutMs - safeLead)

    warningTimerRef.current = setTimeout(() => {
      setShowIdleWarning(true)
    }, warningDelay)

    idleLogoutTimerRef.current = setTimeout(() => {
      void signOutAndRedirect('idle')
    }, cfg.idleTimeoutMs)
  }, [clearIdleTimers, signOutAndRedirect])

  const bumpActivity = useCallback(() => {
    const cfg = configRef.current
    if (cfg.idleDisabled || cfg.idleTimeoutMs <= 0) return
    setShowIdleWarning(false)
    scheduleIdleTimers()
  }, [scheduleIdleTimers])

  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return
      if (event === 'SIGNED_IN' && newSession) {
        setLoginAtNow()
      }
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (isLoading || !session) return
    try {
      if (!sessionStorage.getItem(LOGIN_AT_SESSION_KEY)) {
        setLoginAtNow()
      }
    } catch {
      /* ignore */
    }
  }, [isLoading, session])

  useEffect(() => {
    const cfg = configRef.current
    if (isLoading || !session || cfg.maxDisabled || cfg.sessionMaxMs <= 0) {
      if (maxIntervalRef.current) {
        clearInterval(maxIntervalRef.current)
        maxIntervalRef.current = null
      }
      return
    }

    const checkMax = () => {
      const loginAt = getLoginAtMs()
      if (loginAt === null) {
        setLoginAtNow()
        return
      }
      if (Date.now() - loginAt > cfg.sessionMaxMs) {
        void signOutAndRedirect('max')
      }
    }

    checkMax()
    maxIntervalRef.current = setInterval(checkMax, MAX_SESSION_CHECK_MS)
    return () => {
      if (maxIntervalRef.current) {
        clearInterval(maxIntervalRef.current)
        maxIntervalRef.current = null
      }
    }
  }, [isLoading, session, signOutAndRedirect])

  useEffect(() => {
    if (isLoading || !session) {
      clearIdleTimers()
      setShowIdleWarning(false)
      return
    }
    const cfg = configRef.current
    if (cfg.idleDisabled || cfg.idleTimeoutMs <= 0) return

    scheduleIdleTimers()
    return () => clearIdleTimers()
  }, [isLoading, session, clearIdleTimers, scheduleIdleTimers])

  // App Router soft navigations don't fire `popstate`; poll pathname instead of `usePathname()`.
  useEffect(() => {
    if (!session || isLoading) return
    const cfg = configRef.current
    if (cfg.idleDisabled || cfg.idleTimeoutMs <= 0) return

    lastPathPollRef.current =
      typeof window !== 'undefined' ? window.location.pathname : ''
    const id = window.setInterval(() => {
      const p = window.location.pathname
      if (p !== lastPathPollRef.current) {
        lastPathPollRef.current = p
        bumpActivity()
      }
    }, PATHNAME_POLL_MS)
    return () => clearInterval(id)
  }, [session, isLoading, bumpActivity])

  useEffect(() => {
    if (isLoading || !session) return
    const cfg = configRef.current
    if (cfg.idleDisabled || cfg.idleTimeoutMs <= 0) return

    const onPointer = () => bumpActivity()
    const onKey = () => bumpActivity()

    const onMouseMove = () => {
      if (!cfg.trackMousemove) return
      const now = Date.now()
      if (now - lastMousemoveRef.current < MOUSEMOVE_THROTTLE_MS) return
      lastMousemoveRef.current = now
      bumpActivity()
    }

    window.addEventListener('click', onPointer, { capture: true, passive: true })
    window.addEventListener('keydown', onKey, { capture: true, passive: true })
    window.addEventListener('mousemove', onMouseMove, { capture: true, passive: true })

    return () => {
      window.removeEventListener('click', onPointer, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousemove', onMouseMove, true)
    }
  }, [isLoading, session, bumpActivity])

  const onStaySignedIn = () => {
    bumpActivity()
  }

  if (!session || isLoading) return null

  const cfg = configRef.current
  if (cfg.idleDisabled || cfg.idleTimeoutMs <= 0 || !showIdleWarning) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-idle-title"
      aria-describedby="session-idle-desc"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="session-idle-title" className="text-lg font-semibold text-slate-900">
          Still there?
        </h2>
        <p id="session-idle-desc" className="mt-2 text-sm text-slate-600">
          You will be signed out soon after a period of inactivity. Choose Stay signed in to
          continue your session.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            onClick={onStaySignedIn}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  )
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

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | null
      if (
        String(reason?.name ?? '') === 'AbortError' ||
        String(reason?.message ?? '').includes('signal is aborted')
      ) {
        event.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

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
        if (cancelled) return
        setProfile(null)
        return
      }
      if (cancelled) return
      setProfile(p)
    })
    return () => { cancelled = true }
  }, [user?.id])

  // Initialize auth state on mount
  useEffect(() => {
    let cancelled = false
    const initializeAuth = async () => {
      try {
        const supabase = createSupabaseClient()

        await enforceAppSessionEpochSignOut(() => supabase.auth.signOut())
        if (cancelled) return

        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession()
        if (cancelled) return

        if (error) {
          if (String((error as { name?: string } | null)?.name ?? '') === 'AbortError') {
            setIsError(false)
            return
          }
          if (isInvalidOrMissingRefreshTokenError(error)) {
            try {
              await supabase.auth.signOut()
            } catch {
              /* ignore */
            }
            if (cancelled) return
            setSession(null)
            setUser(null)
            setIsError(false)
          } else {
            console.error('Error getting session:', error)
            setIsError(true)
          }
        } else {
          setSession(initialSession)
          setUser(initialSession?.user || null)
        }
      } catch (err) {
        if (cancelled) return
        if (String((err as { name?: string } | null)?.name ?? '') === 'AbortError') {
          setIsError(false)
          return
        }
        if (isInvalidOrMissingRefreshTokenError(err)) {
          try {
            const supabase = createSupabaseClient()
            await supabase.auth.signOut()
          } catch {
            /* ignore */
          }
          if (cancelled) return
          setSession(null)
          setUser(null)
          setIsError(false)
        } else {
          console.error('Auth initialization error:', err)
          setIsError(true)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void initializeAuth()
    return () => {
      cancelled = true
    }
  }, [])

  // Subscribe to auth state changes
  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return
      setSession(newSession)
      setUser(newSession?.user || null)
      setIsLoading(false)

      if (process.env.NODE_ENV === 'development') {
        console.log('Auth event:', event, '| User:', newSession?.user?.email)
      }
    })

    return () => {
      cancelled = true
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

  return (
    <AuthContext.Provider value={value}>
      <SessionLifecycle />
      {children}
    </AuthContext.Provider>
  )
}
