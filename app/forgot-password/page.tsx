'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/security/TurnstileWidget'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { sanitizePlainText } from '@/lib/validation/safeText'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)

  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())

  const onTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token)
  }, [])

  const onTurnstileExpire = useCallback(() => {
    setTurnstileToken(null)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (turnstileEnabled && !turnstileToken) {
        setError('Please complete the CAPTCHA.')
        return
      }

      const clean = sanitizePlainText(email, 320).trim()
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: clean,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        turnstileRef.current?.reset()
        setTurnstileToken(null)
        setError(typeof data.error === 'string' ? data.error : 'Request failed.')
        return
      }
      setMessage(
        typeof data.message === 'string'
          ? data.message
          : 'If an account exists for that email, a reset message was sent.',
      )
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
          Enter your email and we will send a link to reset your password. Links expire in 15 minutes.
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
          <TurnstileWidget
            ref={turnstileRef}
            onToken={onTurnstileToken}
            onExpire={onTurnstileExpire}
          />
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
