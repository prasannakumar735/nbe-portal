'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useBrowserPathname } from '@/lib/app/useBrowserPathname'
import { buildPortalSidebarNavItems } from '@/lib/portal/technicianPortal'

interface SidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen: boolean
  onCloseMobile: () => void
  portalRole: string | null
  portalManagerOrAdmin: boolean
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  portalRole,
  portalManagerOrAdmin,
}: SidebarProps) {
  const router = useRouter()
  const pathname = useBrowserPathname()
  const [isMobile, setIsMobile] = useState(false)

  const navItems = buildPortalSidebarNavItems(portalRole, portalManagerOrAdmin)

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const isNavItemActive = (href: string) => {
    if (href === '/dashboard/people') {
      return pathname === '/dashboard/people'
    }
    if (href === '/dashboard/timecards') {
      return pathname === '/dashboard/timecards'
    }
    if (href === '/reports') {
      return pathname === '/reports' || pathname.startsWith('/manager/reports')
    }
    if (href === '/admin/clients') {
      return pathname === '/admin/clients' || pathname.startsWith('/admin/clients/')
    }
    if (href === '/dashboard/quotes/service') {
      return pathname.startsWith('/dashboard/quotes/service')
    }
    return pathname === href
  }

  const handleNavigation = (href: string) => {
    router.push(href)
    if (isMobile) {
      onCloseMobile()
    }
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 flex h-screen flex-col bg-white border-r border-slate-200 z-40
          transition-all duration-300 ease-in-out overflow-hidden
          ${isMobile 
            ? `w-64 ${isMobileOpen ? 'flex translate-x-0' : 'hidden -translate-x-full'}` 
            : `hidden md:flex ${isCollapsed ? 'w-[72px]' : 'w-[240px]'}`
          }
        `}
      >
        {/* Logo Section - Always Fixed Size */}
        <div className={`h-16 flex items-center border-b border-slate-200 shrink-0 overflow-hidden ${
          isCollapsed && !isMobile ? 'justify-center px-2' : 'justify-start px-4'
        }`}>
          <div className="relative flex items-center justify-center min-w-[56px]">
            <img
              src="/NBE_LOGO_2026_BG.svg"
              alt="NBE Australia"
              width={112}
              height={65}
              decoding="async"
              className="h-12 max-h-12 w-auto max-w-[min(160px,100%)] object-contain"
              style={{ maxHeight: '3rem', maxWidth: 'min(160px, 100%)', minWidth: '56px' }}
            />
          </div>
        </div>

        {/* Navigation Items - No Scroll */}
        <nav className="flex-1 flex flex-col py-2 px-2 overflow-hidden">
          {navItems.map((item, index) => {
            const isActive = isNavItemActive(item.href)
            const isDashboard = item.label === 'Dashboard'
            
            return (
              <div key={item.href} className="relative">
                <button
                  onClick={() => handleNavigation(item.href)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-lg
                    transition-all duration-200 group relative
                    ${isActive
                      ? 'bg-indigo-50 text-indigo-600 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                    }
                    ${isCollapsed && !isMobile ? 'justify-center' : ''}
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span 
                    className={`material-symbols-outlined text-[20px] shrink-0 ${
                      isActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span 
                    className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${
                      isCollapsed && !isMobile ? 'w-0 opacity-0' : 'flex-1 opacity-100'
                    }`}
                  >
                    {item.label}
                  </span>
                  
                  {/* Collapse Toggle - Only on Dashboard */}
                  {isDashboard && !isMobile && !isCollapsed && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleCollapse()
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          onToggleCollapse()
                        }
                      }}
                      className="p-1 hover:bg-slate-200 rounded transition-all duration-300 cursor-pointer"
                      aria-label="Collapse sidebar"
                    >
                      <span className="material-symbols-outlined text-slate-600 text-[18px]">
                        chevron_left
                      </span>
                    </span>
                  )}
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && !isMobile && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </button>
                
                {/* Expand Button - When Collapsed (Outside button) */}
                {isDashboard && !isMobile && isCollapsed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleCollapse()
                    }}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition-colors z-50"
                    aria-label="Expand sidebar"
                  >
                    <span className="material-symbols-outlined text-slate-600 text-[16px]">
                      chevron_right
                    </span>
                  </button>
                )}
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}


