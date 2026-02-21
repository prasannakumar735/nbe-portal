'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'

type DashboardAuthGuardProps = {
  children: ReactNode
}

/**
 * DashboardAuthGuard: Client-side auth check for protected pages
 * 
 * Verifies session before rendering dashboard content.
 * Redirects to login if no session found.
 */
export function DashboardAuthGuard({ children }: DashboardAuthGuardProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          setError('Failed to verify session')
          setIsAuthenticated(false)
          router.push('/login')
          return
        }

        if (!data.session) {
          setIsAuthenticated(false)
          router.push('/login')
          return
        }

        setIsAuthenticated(true)
      } catch (err) {
        console.error('Auth check error:', err)
        setError('Authentication check failed')
        setIsAuthenticated(false)
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="text-red-600 font-semibold mb-2">{error || 'Authentication failed'}</div>
          <p className="text-slate-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
