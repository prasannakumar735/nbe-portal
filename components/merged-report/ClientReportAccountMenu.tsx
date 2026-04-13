'use client'

import {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/AuthProvider'
import { createSupabaseClient } from '@/lib/supabase/client'
import { isClientRole } from '@/lib/auth/roles'

const MENU_WIDTH_PX = 224
const MENU_GAP_PX = 8

function computeMenuStyle(anchor: HTMLElement | null): CSSProperties {
  if (!anchor || typeof window === 'undefined') return {}
  const r = anchor.getBoundingClientRect()
  return {
    position: 'fixed',
    top: r.bottom + MENU_GAP_PX,
    right: Math.max(8, window.innerWidth - r.right),
    width: MENU_WIDTH_PX,
    zIndex: 10000,
  }
}

const itemClass =
  'flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50'

function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  if (local.length >= 2) return local.slice(0, 2).toUpperCase()
  return local.slice(0, 1).toUpperCase() || '?'
}

/**
 * Profile / change password / logout for client users on `/report/view/*` (no app/client layout).
 */
export function ClientReportAccountMenu() {
  const router = useRouter()
  const { user, profile, isLoading } = useAuth()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  const close = useCallback(() => setOpen(false), [])

  const reposition = useCallback(() => {
    setMenuStyle(computeMenuStyle(anchorRef.current))
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createSupabaseClient()
      await supabase.auth.signOut()
      router.push('/client/login')
      router.refresh()
    } catch (e) {
      console.error('Logout failed:', e)
      setIsLoggingOut(false)
    }
  }

  if (isLoading) return null
  if (!user || !isClientRole(profile)) return null

  const email = user.email ?? ''
  const displayName =
    (profile?.full_name && String(profile.full_name).trim()) || email.split('@')[0] || 'User'

  const panel =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <div className="fixed inset-0 z-[9998]" aria-hidden onClick={close} />
        <div
          role="menu"
          aria-label="Account"
          className="fixed rounded-lg border border-slate-200 bg-white py-2 shadow-lg"
          style={menuStyle}
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="mt-0.5 text-xs text-slate-500">{email}</p>
          </div>

          <Link href="/client/profile" role="menuitem" className={itemClass} onClick={close}>
            <span className="material-symbols-outlined text-[18px]">person</span>
            Profile
          </Link>

          <Link href="/client/change-password" role="menuitem" className={itemClass} onClick={close}>
            <span className="material-symbols-outlined text-[18px]">key</span>
            Change password
          </Link>

          <button
            type="button"
            role="menuitem"
            disabled={isLoggingOut}
            className={`${itemClass} text-left transition-colors disabled:opacity-50`}
            onClick={() => void handleLogout()}
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>{isLoggingOut ? 'Logging out…' : 'Log out'}</span>
          </button>
        </div>
      </>,
      document.body
    )

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-slate-100 bg-slate-200 text-xs font-semibold text-slate-700 shadow-sm"
          aria-hidden
        >
          {initialsFromEmail(email)}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-sm font-semibold leading-tight text-slate-900">{displayName}</p>
          <p className="text-xs leading-tight text-sky-600">Client</p>
        </div>
        <span className="material-symbols-outlined text-[18px] text-slate-400">expand_more</span>
      </button>
      {panel}
    </div>
  )
}
