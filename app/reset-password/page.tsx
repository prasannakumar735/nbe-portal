'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = createSupabaseClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
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
          Choose a strong password for your portal account.
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
