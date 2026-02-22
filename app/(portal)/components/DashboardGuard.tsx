'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'

type RouteGuardProps = {
  children: ReactNode
}

/**
 * RouteGuard - Protects all routes inside (portal) group
 * 
 * KEY FEATURES:
 * - Uses AuthProvider context (not direct session checks)
 * - Prevents flash of login content
 * - No infinite redirect loops
 * - Respects session persistence across routes
 * 
 * FLOW:
 * 1. Component mounts → reads session from AuthProvider context
 * 2. If loading → show spinner (don't render children yet)
 * 3. If no session → redirect to /login using router.replace()
 * 4. If session exists → render children
 * 
 * CRITICAL:
 * - Do NOT call getSession() directly here (already done in AuthProvider)
 * - Do NOT redirect in render body (only in useEffect)
 * - Do NOT create infinite redirects
 * 
 * PRODUCTION FIX:
 * - Uses context instead of creating new auth checks
 * - Session is shared across all protected routes
 * - Navigating /login → /dashboard → /timecard maintains session
 */

export function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter()
  const { session, isLoading } = useAuth()

  // Redirect to login if no session (after loading completes)
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/login')
    }
  }, [isLoading, session, router])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If no session and not loading, don't render children (redirect will happen)
  if (!session) {
    return null
  }

  // Session exists, render protected content
  return <>{children}</>
}
