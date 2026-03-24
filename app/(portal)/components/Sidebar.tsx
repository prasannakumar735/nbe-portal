'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'

interface SidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen: boolean
  onCloseMobile: () => void
}

const NAV_ITEMS = [
  { label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
  { label: 'Service Quotes', icon: 'request_quote', href: '/dashboard/quotes/service' },
  { label: 'Timecard', icon: 'schedule', href: '/timecard' },
  { label: 'Maintenance Service', icon: 'build', href: '/maintenance' },
  { label: 'QR Codes', icon: 'qr_code_2', href: '/qr-codes' },
  { label: 'Reimbursement', icon: 'payments', href: '/reimbursement' },
  { label: 'PVC Strip Calculator', icon: 'calculate', href: '/pvc-calculator' },
  { label: 'Shared Calendar', icon: 'calendar_today', href: '/calendar' },
  { label: 'Job Card & Client GPS', icon: 'location_on', href: '/job-card' },
  { label: 'Knowledge Share', icon: 'menu_book', href: '/knowledge' },
  { label: 'Reports', icon: 'bar_chart', href: '/reports' },
]

export function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAdmin, isManager } = useAuth()
  const [isMobile, setIsMobile] = useState(false)

  const navItems = (isAdmin || isManager)
    ? [
        ...NAV_ITEMS,
        { label: 'Inventory', icon: 'inventory_2', href: '/admin/inventory' },
        { label: 'Contacts', icon: 'contacts', href: '/admin/contacts' },
      ]
    : NAV_ITEMS

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const isNavItemActive = (href: string) => pathname === href

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
          fixed top-0 left-0 h-screen bg-white border-r border-slate-200 z-40
          transition-all duration-300 ease-in-out flex-col overflow-hidden
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
              src="/Logo_black.png"
              alt="NBE Australia"
              className="h-10 w-auto object-contain"
              style={{ minWidth: '56px' }}
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


