'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

/** Policy: 8–20 chars, upper, lower, digit, special @$!%*?& only */
export const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/

const POLICY_HINT = 'Use a strong password that meets the required security criteria.'

const MAX_ATTEMPTS = 5

type FieldErrors = {
  current?: string
  new?: string
  confirm?: string
}

function passwordStrengthScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[@$!%*?&]/.test(pw)) s++
  if (pw.length >= 12 && PASSWORD_POLICY_REGEX.test(pw)) s++
  return Math.min(4, s) as 0 | 1 | 2 | 3 | 4
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  disabled,
  autoComplete,
  show,
  onToggleShow,
  inputTitle,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  disabled: boolean
  autoComplete: string
  show: boolean
  onToggleShow: () => void
  /** Native tooltip (hover only) — e.g. current password hint */
  inputTitle?: string
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          title={inputTitle}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          autoComplete={autoComplete}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        <button
          type="button"
          onClick={onToggleShow}
          disabled={disabled}
          className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <span className="material-symbols-outlined text-[18px] leading-none">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </div>
  )
}

type ChangePasswordFormProps = {
  userEmail: string
  /** After password change (or session loss), redirect here to sign in again (default staff `/login`). */
  signInRedirect?: string
}

export function ChangePasswordForm({ userEmail, signInRedirect = '/login' }: ChangePasswordFormProps) {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [nextPw, setNextPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [blurNew, setBlurNew] = useState(false)
  const [blurConfirm, setBlurConfirm] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const strength = useMemo(() => passwordStrengthScore(nextPw), [nextPw])

  const validateFields = useCallback((): FieldErrors => {
    const err: FieldErrors = {}
    if (!current.trim()) {
      err.current = 'Current password is required'
    }
    if (!nextPw) {
      err.new = 'Enter a new password'
    } else if (!PASSWORD_POLICY_REGEX.test(nextPw)) {
      err.new = POLICY_HINT
    }
    if (!confirm) {
      err.confirm = 'Confirm your new password'
    } else if (nextPw !== confirm) {
      err.confirm = 'Passwords do not match'
    }
    if (current && nextPw && current === nextPw) {
      err.new = 'New password cannot be same as current password'
    }
    return err
  }, [current, nextPw, confirm])

  const errors = useMemo(() => validateFields(), [validateFields])

  const showCurrentError = useMemo(() => {
    if (fieldErrors.current) return fieldErrors.current
    if (attemptedSubmit && errors.current) return errors.current
    return undefined
  }, [fieldErrors.current, attemptedSubmit, errors.current])

  const showNewError = useMemo(() => {
    if (fieldErrors.new) return fieldErrors.new
    if (!blurNew && !attemptedSubmit) return undefined
    return errors.new
  }, [fieldErrors.new, blurNew, attemptedSubmit, errors.new])

  const showConfirmError = useMemo(() => {
    if (fieldErrors.confirm) return fieldErrors.confirm
    if (!blurConfirm && !attemptedSubmit) return undefined
    return errors.confirm
  }, [fieldErrors.confirm, blurConfirm, attemptedSubmit, errors.confirm])

  const canSubmit = useMemo(() => {
    if (loading || attempts >= MAX_ATTEMPTS) return false
    if (!current.trim() || !nextPw || !confirm) return false
    if (Object.keys(validateFields()).length > 0) return false
    return true
  }, [loading, attempts, current, nextPw, confirm, validateFields])

  const strengthLabel = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][strength]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttemptedSubmit(true)
    const v = validateFields()
    setFieldErrors(v)
    if (Object.keys(v).length > 0) return

    const email = userEmail.trim()
    if (!email) {
      toast.error('Session error. Please sign in again.')
      router.replace(signInRedirect)
      return
    }

    setLoading(true)
    setFieldErrors({})

    try {
      const supabase = createSupabaseClient()

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      })

      if (signErr) {
        const nextAttempts = attempts + 1
        setAttempts(nextAttempts)
        if (nextAttempts >= MAX_ATTEMPTS) {
          setFieldErrors({
            current: 'Too many failed attempts. Please wait and try again later.',
          })
        } else {
          setFieldErrors({ current: 'Current password is incorrect' })
        }
        setLoading(false)
        return
      }

      setAttempts(0)

      const { error: updateErr } = await supabase.auth.updateUser({
        password: nextPw,
      })

      if (updateErr) {
        const msg = updateErr.message?.toLowerCase().includes('session')
          ? 'Your session expired. Please sign in again.'
          : updateErr.message || 'Could not update password. Try again.'
        toast.error(msg)
        if (msg.includes('session')) {
          router.replace(signInRedirect)
        }
        setLoading(false)
        return
      }

      setCurrent('')
      setNextPw('')
      setConfirm('')
      setAttemptedSubmit(false)
      toast.success('Password updated successfully')

      await supabase.auth.signOut({ scope: 'global' })
      router.replace(signInRedirect)
    } catch {
      toast.error('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500">{POLICY_HINT}</p>

      <PasswordField
        id="current-password"
        label="Current password"
        value={current}
        inputTitle="Enter your current password"
        onChange={(v) => {
          setCurrent(v)
          setAttempts(0)
          setFieldErrors((f) => ({ ...f, current: undefined }))
        }}
        disabled={loading}
        autoComplete="current-password"
        show={showCurrent}
        onToggleShow={() => setShowCurrent((s) => !s)}
      />
      {showCurrentError && <p className="text-sm text-red-600">{showCurrentError}</p>}

      <PasswordField
        id="new-password"
        label="New password"
        value={nextPw}
        onChange={(v) => {
          setNextPw(v)
          setFieldErrors((f) => ({ ...f, new: undefined }))
        }}
        onBlur={() => setBlurNew(true)}
        disabled={loading}
        autoComplete="new-password"
        show={showNew}
        onToggleShow={() => setShowNew((s) => !s)}
      />
      {nextPw.length > 0 && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < strength ? 'bg-indigo-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500">Strength: {strengthLabel}</p>
        </div>
      )}
      {showNewError && <p className="text-sm text-red-600">{showNewError}</p>}

      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        value={confirm}
        onChange={(v) => {
          setConfirm(v)
          setFieldErrors((f) => ({ ...f, confirm: undefined }))
        }}
        onBlur={() => setBlurConfirm(true)}
        disabled={loading}
        autoComplete="new-password"
        show={showConfirm}
        onToggleShow={() => setShowConfirm((s) => !s)}
      />
      {showConfirmError && <p className="text-sm text-red-600">{showConfirmError}</p>}

      <Button type="submit" loading={loading} disabled={!canSubmit}>
        Update password
      </Button>
    </form>
  )
}
