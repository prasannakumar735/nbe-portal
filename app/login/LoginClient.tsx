'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/security/TurnstileWidget'
import { createSupabaseClient } from '@/lib/supabase/client'

type LoginClientProps = {
  inactiveNotice: boolean
  noProfileNotice: boolean
  /** Matches middleware `x-nonce` for Turnstile `api.js` under `strict-dynamic`. */
  cspNonce?: string
  /** Safe internal path from `?next=` — resolved on the server (no `useSearchParams`). */
  nextRedirect: string | null
}

export function LoginClient({ inactiveNotice, noProfileNotice, cspNonce, nextRedirect }: LoginClientProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)

  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())

  const onTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token)
  }, [])

  const onTurnstileExpire = useCallback(() => {
    setTurnstileToken(null)
  }, [])

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
      if (configError) {
        setError(configError)
        setLoading(false)
        return
      }

      if (turnstileEnabled && !turnstileToken) {
        setError('Please complete the CAPTCHA.')
        setLoading(false)
        return
      }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      })

      const loginJson = (await loginRes.json().catch(() => ({}))) as { error?: string; ok?: boolean }

      if (!loginRes.ok) {
        turnstileRef.current?.reset()
        setTurnstileToken(null)
        setError(
          typeof loginJson.error === 'string'
            ? loginJson.error
            : loginRes.status === 401
              ? 'Invalid email or password. Please try again.'
              : 'Sign in failed. Please try again.',
        )
        setLoading(false)
        return
      }

      const supabase = createSupabaseClient()

      // Login API sets HttpOnly cookies on this response; the browser client may not see the session
      // until the next tick or after cookies are committed — retry briefly, then hard-navigate so
      // middleware always receives the same cookie jar (fixes first-attempt bounce to /login).
      for (let attempt = 0; attempt < 16; attempt++) {
        const {
          data: { session: s },
        } = await supabase.auth.getSession()
        if (s?.user) break
        await new Promise(r => setTimeout(r, 60 + attempt * 20))
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        const { data: staffProfile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', session.user.id)
          .maybeSingle()

        if (staffProfile?.role === 'client') {
          window.location.assign('/client')
          return
        }

        if (staffProfile && staffProfile.is_active === false) {
          await supabase.auth.signOut()
          setError('Your account has been deactivated. Contact an administrator.')
          setLoading(false)
          return
        }
      }

      const nextPath = nextRedirect ?? '/dashboard'
      // Hard navigation: full reload picks up Set-Cookie from login without relying on App Router.
      window.location.assign(nextPath.startsWith('/') ? nextPath : '/dashboard')
    } catch (err) {
      console.error('Login error:', err)

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

          {(inactiveNotice || noProfileNotice) && !error && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
              {inactiveNotice && 'Your session ended because this account is inactive.'}
              {noProfileNotice && 'No portal profile is linked to this account. Contact an administrator.'}
            </div>
          )}

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

            <TurnstileWidget
              ref={turnstileRef}
              onToken={onTurnstileToken}
              onExpire={onTurnstileExpire}
              scriptNonce={cspNonce}
            />

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

          <p className="text-center text-sm mt-4">
            <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
              Forgot password?
            </Link>
          </p>

          <p className="text-center text-xs text-slate-500 mt-6">
            Use your portal credentials to access the dashboard
          </p>
        </div>
      </div>
    </div>
  )
}
