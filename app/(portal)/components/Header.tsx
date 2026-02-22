'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface HeaderProps {
  user: any
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

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

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      {/* Left: Search */}
      <div className="flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Right: Notifications + Profile */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          aria-label="Notifications"
          className="relative text-slate-500 hover:text-indigo-600 transition-colors p-2"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full" />
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-slate-200" />

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors"
          >
            <img
              alt="User avatar"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKSKXCHSDw8msFdZNgb4KwmenM_UEx46i_cPfAHBlBSL27K0OGNpOEYIzwWanJGzzgONR0fXAzZ9toF0Y15GGnvPFgNI_gvDQWCDn6xos0VMvIlvlBoBOzCdl5o85C4YC7eDMJcNvlQMQ512s5jahgLk6uLShA4MW5UA2p-0rsv4WvYgCfXh2CoqtjyjJY0wkGXUuvM065G5mjaZrD6FfbmkLJAP2vNXZhz7BJjMSuPlCsY-REJZe6gcEicJG-59YiQpmdInzw8Q"
              className="w-9 h-9 rounded-full bg-slate-200 border-2 border-slate-100 shadow-sm object-cover"
            />
            <div className="text-left hidden md:block">
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-slate-500 leading-tight">
                {user?.user_metadata?.role || 'Portal User'}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-[18px]">
              expand_more
            </span>
          </button>

          {/* Dropdown Menu */}
          {showProfileMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowProfileMenu(false)}
              />
              
              {/* Menu */}
              <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-20">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900">
                    {user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {user?.email || ''}
                  </p>
                </div>
                
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
