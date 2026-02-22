'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type DashboardGuardProps = {
  children: ReactNode
}

/**
 * DashboardGuard - Protects dashboard routes from unauthenticated access
 * 
 * KEY FEATURES:
 * - Auth check happens in useEffect (not render body) - prevents hydration mismatch
 * - Only redirects when session is definitively NULL
 * - Loading state prevents content flash
 * - No infinite render loops
 * 
 * IMPORTANT:
 * - This is a client component wrapper
 * - Place it around dashboard content, not at page level
 * - Use router.replace() to prevent back-button issues
 */

export function DashboardGuard({ children }: DashboardGuardProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          // No session - redirect to login
          router.replace('/login')
          return
        }

        // Session exists - allow render
        setIsAuthenticated(true)
      } catch (error) {
        console.error('Auth check error:', error)
        // On error, treat as unauthenticated
        router.replace('/login')
      }
    }

    checkAuth()
  }, [router])

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Only render children if authenticated
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
