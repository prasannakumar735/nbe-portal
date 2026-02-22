'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'

/**
 * Login Page
 * 
 * IMPORTANT:
 * - This is a client component
 * - Auth checks happen only in form submission (not in render)
 * - After successful login, session is persisted by Supabase
 * - Uses router.replace() to prevent back-button issues
 * - After login, AuthProvider context updates automatically
 * - User is redirected to /dashboard
 * 
 * PRODUCTION FIX:
 * - Uses singleton Supabase client (no multiple instances)
 * - Session automatically persists to storage
 * - Validates environment variables before attempting login
 * - Enhanced error handling with user-friendly messages
 */

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  // Validate Supabase configuration on mount
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      setConfigError('Supabase configuration is missing. Please check your environment variables.')
    } else if (!supabaseUrl.startsWith('http')) {
      setConfigError('Invalid Supabase URL. Please check your NEXT_PUBLIC_SUPABASE_URL environment variable.')
    }
  }, [])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate configuration before attempting login
      if (configError) {
        setError(configError)
        setLoading(false)
        return
      }

      const supabase = createSupabaseClient()

      // Attempt sign in with proper error handling
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (signInError) {
        // User-friendly error messages
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please confirm your email address before logging in.')
        } else if (signInError.message.includes('Failed to fetch')) {
          setError('Unable to connect to authentication service. Please check your internet connection or contact support.')
        } else {
          setError(signInError.message)
        }
        setLoading(false)
        return
      }

      // Verify session was created
      if (!data.session) {
        setError('Login failed: No session created. Please try again.')
        setLoading(false)
        return
      }

      // Login successful - AuthProvider will detect the session
      // and update its state automatically
      router.replace('/dashboard')
    } catch (err) {
      console.error('Login error:', err)
      
      // Enhanced error handling for network issues
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error: Unable to connect to the server. Please check your internet connection.')
      } else if (err instanceof Error) {
        setError(`Error: ${err.message}`)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      
      setLoading(false)
    }
  }

  // Show configuration error if present
  if (configError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
        <div className="w-full max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-red-600 text-2xl">error</span>
              <div>
                <h2 className="text-lg font-semibold text-red-900 mb-2">Configuration Error</h2>
                <p className="text-sm text-red-700">{configError}</p>
                <p className="text-xs text-red-600 mt-3">
                  Contact your administrator or check the .env.local file.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md border border-slate-200">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/Logo_black.png"
              alt="NBE Australia"
              className="h-12 w-auto object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">
            Portal Login
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <span className="material-symbols-outlined text-red-600 text-lg mt-0.5">warning</span>
              <span className="text-red-700 text-sm flex-1">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            Use your portal credentials to access the dashboard
          </p>
        </div>
      </div>
    </div>
  )
}

