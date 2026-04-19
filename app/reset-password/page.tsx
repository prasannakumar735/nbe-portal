'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { validatePasswordPolicy, passwordPolicySummary } from '@/lib/validation/passwordPolicy'

function ResetPasswordInner() {
  const router = useRouter()
  /** Avoid `useSearchParams()` here — on Next.js 16 it can be undefined briefly and `.get` throws in OuterLayoutRouter. */
  const [tokenFromEmail, setTokenFromEmail] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    const t = new URLSearchParams(window.location.search).get('token')
    setTokenFromEmail(t)
    if (t) setReady(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = new URLSearchParams(window.location.search).get('token')
    if (t) return

    const supabase = createSupabaseClient()
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled) {
        setReady(!!session)
      }
    })()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true)
      }
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const policy = validatePasswordPolicy(password)
    if (!policy.valid) {
      setError(policy.errors.join(' '))
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (tokenFromEmail && tokenFromEmail.length > 0) {
        const res = await fetch('/api/auth/reset-password-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenFromEmail, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Reset failed.')
          return
        }
        toast.success('Your password has been reset successfully. You can sign in with your new password.')
        router.replace('/login')
        router.refresh()
        return
      }

      const supabase = createSupabaseClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      void fetch('/api/auth/password-reset-success-email', { method: 'POST' }).catch(() => {})
      toast.success('Your password has been reset successfully.')
      router.replace('/dashboard')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <img src="/Logo_black.png" alt="NBE Australia" className="h-10 w-auto object-contain" />
        </div>
        <h1 className="text-center text-xl font-semibold text-slate-900">Set new password</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {passwordPolicySummary()}
        </p>

        {!ready ? (
          <p className="mt-6 text-center text-sm text-slate-600">
            Confirming reset link…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              id="new-password"
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
            />
            <Input
              id="confirm-password"
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Update password
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return <ResetPasswordInner />
}
