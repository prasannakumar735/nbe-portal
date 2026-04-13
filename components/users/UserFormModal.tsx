'use client'

import { useEffect, useState } from 'react'
import type { ManagedUserRow } from '@/lib/types/user-management.types'
import { createUser, updateUser } from '@/lib/users/actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, type SelectOption } from '@/components/ui/Select'

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'technician', label: 'Technician' },
]

type Mode = 'add' | 'edit'

type UserFormModalProps = {
  open: boolean
  mode: Mode
  user: ManagedUserRow | null
  onClose: () => void
  onSuccess: (payload?: { tempPassword?: string }) => void
}

function normalizeRole(role: string): 'admin' | 'manager' | 'technician' {
  if (role === 'admin' || role === 'manager') return role
  return 'technician'
}

export function UserFormModal({ open, mode, user, onClose, onSuccess }: UserFormModalProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'manager' | 'technician'>('technician')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setCreatedPassword(null)
    if (mode === 'edit' && user) {
      setFullName(user.full_name ?? '')
      setEmail(user.email)
      setRole(normalizeRole(user.role))
    } else {
      setFullName('')
      setEmail('')
      setRole('technician')
    }
  }, [open, mode, user])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'add') {
        const res = await createUser({
          fullName,
          email,
          role,
        })
        if (!res.ok) {
          setError(res.error)
          return
        }
        setCreatedPassword(res.tempPassword)
        return
      }

      if (mode === 'edit' && user) {
        const res = await updateUser({
          userId: user.id,
          fullName,
          role,
        })
        if (!res.ok) {
          setError(res.error)
          return
        }
        onSuccess()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    if (createdPassword && mode === 'add') {
      onSuccess({ tempPassword: createdPassword })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close modal"
        onClick={handleDismiss}
      />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === 'add' ? 'Add user' : 'Edit user'}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === 'add'
                ? 'Creates a confirmed account with a temporary password.'
                : 'Update display name and role.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="user-full-name"
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={loading}
            autoComplete="name"
          />

          {mode === 'add' ? (
            <Input
              id="user-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          ) : (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">Email</span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {user?.email}
              </div>
            </div>
          )}

          <Select
            id="user-role"
            label="Role"
            options={ROLE_OPTIONS}
            value={role}
            onChange={(e) =>
              setRole(e.target.value as 'admin' | 'manager' | 'technician')
            }
            disabled={loading}
          />

          {createdPassword && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-medium">Temporary password</p>
              <p className="mt-1 break-all font-mono text-xs">{createdPassword}</p>
              <p className="mt-2 text-xs text-amber-900/80">
                Copy this now — it will not be shown again.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleDismiss} disabled={loading}>
              {createdPassword ? 'Done' : 'Cancel'}
            </Button>
            {!createdPassword && (
              <Button type="submit" loading={loading}>
                {mode === 'add' ? 'Create user' : 'Save changes'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
