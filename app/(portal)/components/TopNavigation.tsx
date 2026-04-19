'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useBrowserPathname } from '@/lib/app/useBrowserPathname'
import { useState } from 'react'
import { useOfflinePendingCount } from '@/hooks/useOfflinePendingCount'

interface TopNavigationProps {
  user: any
}

const NAV_ITEMS = [
  { label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
  { label: 'Service Quote', icon: 'request_quote', href: '/dashboard/quotes/service' },
  { label: 'Timecards', icon: 'schedule', href: '/dashboard/timecards' },
  { label: 'Maintenance Service', icon: 'build', href: '/maintenance' },
  { label: 'QR Codes', icon: 'qr_code_2', href: '/qr-codes' },
  { label: 'Reimbursement', icon: 'payments', href: '/reimbursement' },
  { label: 'Shared Calendar', icon: 'calendar_today', href: '/calendar' },
  { label: 'Job Card & Client GPS', icon: 'location_on', href: '/job-card' },
  { label: 'Knowledge Share', icon: 'menu_book', href: '/knowledge' },
  { label: 'Reports', icon: 'bar_chart', href: '/reports' }
]

export function TopNavigation({ user }: TopNavigationProps) {
  const router = useRouter()
  const pathname = useBrowserPathname()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isUserHovered, setIsUserHovered] = useState(false)
  const { pendingCount } = useOfflinePendingCount()

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

  const isNavItemActive = (href: string) => {
    if (href === '/reports') {
      return pathname === '/reports' || pathname.startsWith('/manager/reports')
    }
    if (href === '/dashboard/quotes/service') {
      return pathname.startsWith('/dashboard/quotes/service')
    }
    return pathname === href
  }

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center px-8 shrink-0 z-10">
      {/* Logo */}
      <div className="flex items-center mr-10 shrink-0">
        <img
          src="/Logo_black.png"
          alt="NBE Australia"
          className="h-12 w-auto object-contain"
        />
      </div>

      {/* Navigation Items */}
      <nav className="flex items-center gap-1 h-full flex-1 overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`nav-item h-full flex items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              isNavItemActive(item.href)
                ? 'nav-item-active font-semibold text-primary border-b-2 border-primary'
                : 'text-slate-500 border-b-2 border-transparent hover:text-primary'
            }`}
            aria-current={isNavItemActive(item.href) ? 'page' : undefined}
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Right Section */}
      <div className="flex items-center gap-6 ml-6 shrink-0">
        {pendingCount > 0 && (
          <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
            🔴 {pendingCount} Pending Sync
          </div>
        )}

        {/* Search */}
        <div className="relative w-48 xl:w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-slate-100 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400"
          />
        </div>

        {/* Notifications */}
        <button
          aria-label="Notifications"
          className="relative text-slate-500 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 border-2 border-white rounded-full" />
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-slate-200" />

        {/* User Profile */}
        <div
          className="flex items-center gap-3 relative group"
          onMouseEnter={() => setIsUserHovered(true)}
          onMouseLeave={() => setIsUserHovered(false)}
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">{user?.email?.split('@')[0] || 'User'}</p>
            <p className="text-xs text-slate-500 font-medium">
              {user?.user_metadata?.role || 'Portal User'}
            </p>
          </div>
          <img
            alt="User avatar"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKSKXCHSDw8msFdZNgb4KwmenM_UEx46i_cPfAHBlBSL27K0OGNpOEYIzwWanJGzzgONR0fXAzZ9toF0Y15GGnvPFgNI_gvDQWCDn6xos0VMvIlvlBoBOzCdl5o85C4YC7eDMJcNvlQMQ512s5jahgLk6uLShA4MW5UA2p-0rsv4WvYgCfXh2CoqtjyjJY0wkGXUuvM065G5mjaZrD6FfbmkLJAP2vNXZhz7BJjMSuPlCsY-REJZe6gcEicJG-59YiQpmdInzw8Q"
            className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden shadow-sm object-cover"
          />
          {isUserHovered && (
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="absolute top-full mt-2 right-0 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all duration-200 disabled:opacity-50 shadow-md border border-slate-200 whitespace-nowrap"
            >
              {isLoggingOut ? '...' : 'Logout'}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
