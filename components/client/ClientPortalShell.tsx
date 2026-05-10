'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useState, type ReactNode } from 'react'
import NBELogo from '@/components/common/NBELogo'
import { useAuth } from '@/app/providers/AuthProvider'
import { createSupabaseClient } from '@/lib/supabase/client'
import { isClientRole } from '@/lib/auth/roles'
import { ClientPortalAccountMenu } from '@/components/client/ClientPortalAccountMenu'

const navLinkClass =
  'block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900'

const ACTIVE_NAV =
  ' bg-slate-900 text-white hover:bg-slate-900 hover:text-white' as const

function navActiveClass(pathname: string, href: string): string {
  if (href === '/client') {
    return pathname === '/client' ? ACTIVE_NAV : ''
  }
  if (href === '/client/reports') {
    const pdfViewer = pathname.startsWith('/report/view')
    if (pathname === '/client/reports' || pdfViewer) {
      return ACTIVE_NAV
    }
    return ''
  }
  return pathname === href || pathname.startsWith(`${href}/`) ? ACTIVE_NAV : ''
}

export function ClientPortalShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, isLoading } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleLogout = useCallback(async () => {
    setSigningOut(true)
    try {
      const supabase = createSupabaseClient()
      await supabase.auth.signOut()
      router.push('/login?next=/client')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }, [router])

  const isClient = isClientRole(profile)

  /** Guest landing: server redirects to unified `/login`, but keep fallback for edge timing */
  const hideAside = pathname === '/client' && !user
  const showPortalHeader = true

  return (
    <div
      className={`flex min-h-screen flex-col bg-slate-100 ${hideAside ? '' : 'md:flex-row'}`}
    >
      {!hideAside ? (
      <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:w-56 md:border-b-0 md:border-r md:border-slate-200">
        <div className="border-b border-slate-100 px-4 py-4 md:border-slate-100">
          <Link href="/client" className="inline-block max-w-[200px]">
            <NBELogo />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {isLoading ? (
            <span className="px-3 py-2 text-xs text-slate-400">Loading…</span>
          ) : !user ? (
            <>
              <Link href="/login?next=/client" className={navLinkClass}>
                Sign in
              </Link>
              <Link href="/login" className={`${navLinkClass} text-xs text-slate-500`}>
                Staff portal sign in
              </Link>
            </>
          ) : isClient ? (
            <>
              <Link href="/client" className={`${navLinkClass}${navActiveClass(pathname, '/client')}`}>
                Dashboard
              </Link>
              <Link href="/client/reports" className={`${navLinkClass}${navActiveClass(pathname, '/client/reports')}`}>
                Maintenance reports
              </Link>
              <Link href="/client/gallery" className={`${navLinkClass}${navActiveClass(pathname, '/client/gallery')}`}>
                Photo gallery
              </Link>
            </>
          ) : (
            <div className="space-y-2 px-3 text-xs text-slate-600">
              <p>Staff account — use the main portal.</p>
              <Link href="/dashboard" className="font-semibold text-indigo-700 underline">
                Open dashboard
              </Link>
            </div>
          )}
        </nav>

        <p className="hidden px-4 pb-4 text-[10px] text-slate-400 md:block">Client report access</p>
      </aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {showPortalHeader && (
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-slate-600 sm:text-base">Client portal</div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span aria-hidden>🔒</span>
                  Secure portal
                </div>
                <ClientPortalAccountMenu />
              </div>
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </div>
    </div>
  )
}
