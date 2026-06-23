'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'

type RouteGuardProps = {
  children: ReactNode
}

function AuthLoadingShell() {
  return (
    <div
      className="flex items-center justify-center min-h-screen bg-slate-50"
      suppressHydrationWarning
    >
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Loading...</p>
      </div>
    </div>
  )
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect to login if no session (after loading completes)
  useEffect(() => {
    if (!mounted || isLoading) return
    if (!session) {
      router.replace('/login')
    }
  }, [mounted, isLoading, session, router])

  if (!mounted || isLoading) {
    return <AuthLoadingShell />
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}
