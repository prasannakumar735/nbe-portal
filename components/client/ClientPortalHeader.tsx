'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import NBELogo from '@/components/common/NBELogo'
import { useAuth } from '@/app/providers/AuthProvider'
import { createSupabaseClient } from '@/lib/supabase/client'
import { isClientRole } from '@/lib/auth/roles'

export function ClientPortalHeader() {
  const router = useRouter()
  const { user, profile, isLoading } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleLogout = useCallback(async () => {
    setSigningOut(true)
    try {
      const supabase = createSupabaseClient()
      await supabase.auth.signOut()
      router.push('/client/login')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }, [router])

  const isClient = isClientRole(profile)

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <Link href="/client" className="shrink-0">
          <NBELogo />
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
          {isLoading ? (
            <span className="text-xs text-slate-400">Loading…</span>
          ) : !user ? (
            <>
              <Link
                href="/client/login"
                className="font-medium text-slate-900 underline decoration-slate-400 underline-offset-2 hover:text-slate-700"
              >
                Sign in
              </Link>
              <span className="text-xs text-slate-500">Client report access</span>
            </>
          ) : isClient ? (
            <>
              <nav className="flex flex-wrap items-center gap-3">
                <Link
                  href="/client/profile"
                  className="font-medium text-slate-800 hover:text-slate-950 hover:underline"
                >
                  Profile
                </Link>
                <Link
                  href="/client/change-password"
                  className="font-medium text-slate-800 hover:text-slate-950 hover:underline"
                >
                  Change password
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={signingOut}
                  className="font-medium text-slate-800 hover:text-slate-950 hover:underline disabled:opacity-50"
                >
                  {signingOut ? 'Signing out…' : 'Log out'}
                </button>
              </nav>
              <span className="text-xs text-slate-500">Client report access</span>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>Staff account — use the main portal.</span>
              <Link href="/dashboard" className="font-semibold text-slate-900 underline">
                Dashboard
              </Link>
              <span className="text-slate-400">|</span>
              <span className="text-xs text-slate-500">Client report access</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
