'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '../lib/supabase'

export default function Home() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase.auth.getSession()
        
        if (data.session) {
          // User is already logged in, redirect to dashboard
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Auth check error:', error)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    setErrorMsg(null)

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.')
      return
    }

    try {
      setIsSubmitting(true)
      const supabase = getSupabaseClient()

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      if (data.user) {
        // Wait for session to be established
        const { data: sessionData } = await supabase.auth.getSession()
        
        if (sessionData.session) {
          // Force refresh to ensure session is persisted
          router.refresh()
          // Small delay to allow refresh to complete
          await new Promise(resolve => setTimeout(resolve, 100))
          router.push('/dashboard')
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected login error.'

      if (message.toLowerCase().includes('failed to fetch')) {
        setErrorMsg('Unable to reach Supabase. Check your internet connection.')
      } else {
        setErrorMsg(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">NBE Portal Login</h1>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="space-y-1">
            <label htmlFor="login-email" className="text-sm font-medium text-slate-700">Email Address</label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="name@company.com"
              className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="login-password" className="text-sm font-medium text-slate-700">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-60 transition-colors shadow-sm"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
