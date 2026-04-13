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
import { supabase } from '@/lib/supabase'

/** Dedicated change-password page (sensitive action, separate from profile). */
export const CHANGE_PASSWORD_HREF = '/dashboard/change-password'

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

export type UserDropdownUser = {
  email?: string | null
  user_metadata?: { role?: string }
}

type UserDropdownProps = {
  user: UserDropdownUser
}

const itemClass =
  'flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50'

/**
 * Account menu: Profile → Change Password → Logout.
 * Rendered in a portal so parent overflow/stacking cannot hide rows.
 * Change Password is never role-gated or feature-flagged.
 */
export function UserDropdown({ user }: UserDropdownProps) {
  const router = useRouter()
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
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Logout failed:', error)
      setIsLoggingOut(false)
    }
  }

  const displayName = user?.email?.split('@')[0] || 'User'
  const roleLabel = user?.user_metadata?.role || 'Portal User'

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
            <p className="mt-0.5 text-xs text-slate-500">{user?.email || ''}</p>
          </div>

          <Link
            href="/dashboard/profile"
            role="menuitem"
            className={itemClass}
            onClick={close}
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            Profile
          </Link>

          <Link
            href={CHANGE_PASSWORD_HREF}
            role="menuitem"
            className={itemClass}
            onClick={close}
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
            Change Password
          </Link>

          <button
            type="button"
            role="menuitem"
            disabled={isLoggingOut}
            className={`${itemClass} text-left transition-colors disabled:opacity-50`}
            onClick={() => {
              void handleLogout()
            }}
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
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
        className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
      >
        <img
          alt=""
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKSKXCHSDw8msFdZNgb4KwmenM_UEx46i_cPfAHBlBSL27K0OGNpOEYIzwWanJGzzgONR0fXAzZ9toF0Y15GGnvPFgNI_gvDQWCDn6xos0VMvIlvlBoBOzCdl5o85C4YC7eDMJcNvlQMQ512s5jahgLk6uLShA4MW5UA2p-0rsv4WvYgCfXh2CoqtjyjJY0wkGXUuvM065G5mjaZrD6FfbmkLJAP2vNXZhz7BJjMSuPlCsY-REJZe6gcEicJG-59YiQpmdInzw8Q"
          className="h-9 w-9 rounded-full border-2 border-slate-100 bg-slate-200 object-cover shadow-sm"
        />
        <div className="hidden text-left md:block">
          <p className="text-sm font-semibold leading-tight text-slate-900">{displayName}</p>
          <p className="text-xs leading-tight text-slate-500">{roleLabel}</p>
        </div>
        <span className="material-symbols-outlined text-[18px] text-slate-400">expand_more</span>
      </button>
      {panel}
    </div>
  )
}
