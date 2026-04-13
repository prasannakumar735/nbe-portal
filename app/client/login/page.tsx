'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase/client'

function ClientLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/client'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createSupabaseClient()
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signErr) {
        setError(signErr.message.includes('Invalid') ? 'Invalid email or password.' : signErr.message)
        setLoading(false)
        return
      }
      if (!data.session?.user) {
        setError('Login failed.')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', data.session.user.id)
        .maybeSingle()

      if (profile?.role !== 'client') {
        await supabase.auth.signOut()
        setError('This page is for client accounts only. Use the main staff portal to sign in.')
        setLoading(false)
        return
      }

      if (profile?.is_active === false) {
        await supabase.auth.signOut()
        setError('This account has been disabled. Contact NBE if you need access.')
        setLoading(false)
        return
      }

      const allowed =
        redirectTo.startsWith('/client') ||
        redirectTo.startsWith('/report/view/')
      router.replace(allowed ? redirectTo : '/client')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">Client sign in</h1>
      <p className="mt-1 text-sm text-slate-600">
        Use the email and password provided for your organisation to open your report.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="client-email" className="block text-sm font-medium text-slate-800">
            Email
          </label>
          <input
            id="client-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/15"
          />
        </div>
        <div>
          <label htmlFor="client-password" className="block text-sm font-medium text-slate-800">
            Password
          </label>
          <input
            id="client-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/15"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        Staff member?{' '}
        <Link href="/login" className="font-medium text-slate-800 underline">
          Main portal login
        </Link>
      </p>
    </div>
  )
}

export default function ClientLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12 text-sm text-slate-500">Loading…</div>
      }
    >
      <ClientLoginForm />
    </Suspense>
  )
}
