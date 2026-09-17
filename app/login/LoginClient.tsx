'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/security/TurnstileWidget'
import { AuthScreenLogo } from '@/components/common/AuthScreenLogo'
import pkg from '@/package.json'

type LoginClientProps = {
  inactiveNotice: boolean
  noProfileNotice: boolean
  /** Matches middleware `x-nonce` for Turnstile `api.js` under `strict-dynamic`. */
  cspNonce?: string
  /** Safe internal path from `?next=` — resolved on the server (no `useSearchParams`). */
  nextRedirect: string | null
  /** Classic logo + client-oriented footer when arriving from client/report flows. */
  clientPortalBranding?: boolean
}

function resolvePostLoginDestination(
  role: string | null | undefined,
  next: string | null,
): string {
  const n = next && next.startsWith('/') ? next : null
  if (role === 'client') {
    if (n && (n.startsWith('/client') || n.startsWith('/report/view/'))) {
      return n
    }
    return '/client'
  }
  if (n?.startsWith('/client')) {
    
    return '/dashboard'
  }
  return n ?? '/dashboard'
}

export function LoginClient({
  inactiveNotice,
  noProfileNotice,
  cspNonce,
  nextRedirect,
  clientPortalBranding = false,
}: LoginClientProps) {
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

      const loginJson = (await loginRes.json().catch(() => ({}))) as {
        error?: string; ok?: boolean; role?: string | null; isActive?: boolean
      }

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

      if (loginJson.isActive === false) {
        setError('Your account has been deactivated. Contact an administrator.')
        setLoading(false)
        return
      }

      // API returns role so no browser Supabase client is needed — avoids AbortErrors on navigate
      const dest = resolvePostLoginDestination(loginJson.role ?? null, nextRedirect)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Login debug] navigating to', dest, '— any AbortErrors after this line are from pending Supabase lock operations being cancelled by the browser unload')
      }
      window.location.assign(dest.startsWith('/') ? dest : '/dashboard')
    } catch (err) {
      // AbortError means the page navigated away while a request was in-flight — login succeeded.
      if (err instanceof Error && err.name === 'AbortError') return

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

  if (clientPortalBranding) {
    return (
      <div className="flex min-h-screen">
        {/* Left panel */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col items-center justify-center bg-white relative overflow-hidden border-r border-slate-100">
          <div className="flex flex-col items-center text-center px-12">
            <AuthScreenLogo variant="legacy" className="!h-auto !max-h-48 w-full max-w-xs object-contain mb-10" />
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Welcome back</h2>
            <p className="text-slate-500 text-lg max-w-sm leading-relaxed">
              Secure access to your organisation&rsquo;s maintenance records, inspection reports, and shared documents.
            </p>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-12">
          {/* Logo on mobile */}
          <div className="mb-8 flex justify-center lg:hidden">
            <AuthScreenLogo variant="legacy" className="!h-52 !max-h-52 !max-w-[min(380px,90vw)]" />
          </div>

          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Client portal</h1>
              <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue</p>
            </div>

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
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
                  placeholder="your@email.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
                  placeholder="••••••••" required />
              </div>
              <TurnstileWidget ref={turnstileRef} onToken={onTurnstileToken} onExpire={onTurnstileExpire} scriptNonce={cspNonce} />
              <button type="submit" disabled={loading}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-2">
                {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              </button>
            </form>

            <p className="text-center text-sm mt-5">
              <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">Forgot password?</Link>
            </p>

            <p className="text-center text-xs text-slate-400 mt-6">
              NBE staff should use the{' '}
              <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">internal portal sign-in</Link>.
            </p>

            <p className="text-center text-[11px] font-mono text-slate-300 mt-8 select-none">
              v{pkg.version}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col items-center justify-center bg-white relative overflow-hidden border-r border-slate-100">
        <div className="flex flex-col items-center text-center px-12">
          <img
            src="/Portal_logo.png"
            alt="NBE Portal"
            className="w-full max-w-lg object-contain mb-10"
            style={{ maxHeight: '55vh' }}
          />
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Welcome back</h2>
          <p className="text-slate-500 text-lg max-w-sm leading-relaxed">
            Your central hub for maintenance records, job cards, timecards, and more.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-12">
        {/* Logo shown on mobile (left panel hidden) */}
        <div className="mb-8 flex justify-center lg:hidden">
          <AuthScreenLogo variant="default" className="!h-52 !max-h-52 !max-w-[min(380px,90vw)]" />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Portal login</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue</p>
          </div>

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
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
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
              className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>

          <p className="text-center text-sm mt-5">
            <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
              Forgot password?
            </Link>
          </p>

          <p className="text-center text-xs text-slate-400 mt-6">
            Maintenance client?{' '}
            <Link href="/login?next=/client" className="font-medium text-indigo-600 hover:text-indigo-500">
              Client portal sign-in
            </Link>
          </p>

          <p className="text-center text-[11px] font-mono text-slate-300 mt-8 select-none">
            v{pkg.version}
          </p>
        </div>
      </div>
    </div>
  )
}
