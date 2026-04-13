'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const supabase = createSupabaseClient()
      const origin =
        typeof window !== 'undefined' ? window.location.origin : ''
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/reset-password`,
      })
      if (resetError) {
        setError(resetError.message)
        return
      }
      setMessage('Check your email for a password reset link.')
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
        <h1 className="text-center text-xl font-semibold text-slate-900">Forgot password</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Enter your email and we will send a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            id="forgot-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
          />
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {message && (
            <p className="text-sm text-emerald-700">{message}</p>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            Send reset link
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
