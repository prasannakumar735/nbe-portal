'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useBrowserPathname } from '@/lib/app/useBrowserPathname'
import { buildPortalSidebarNavItems } from '@/lib/portal/technicianPortal'
import type { FeatureFlags } from '@/lib/featureFlags'
import pkg from '@/package.json'

interface SidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen: boolean
  onCloseMobile: () => void
  portalRole: string | null
  portalManagerOrAdmin: boolean
  featureFlags: FeatureFlags
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  portalRole,
  portalManagerOrAdmin,
  featureFlags,
}: SidebarProps) {
  const router = useRouter()
  const pathname = useBrowserPathname()
  const [isMobile, setIsMobile] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const navItems = buildPortalSidebarNavItems(portalRole, portalManagerOrAdmin, featureFlags)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-expand parent items when a child route is active
  useEffect(() => {
    const toExpand = new Set<string>()
    for (const item of navItems) {
      if (item.children?.some((child) => pathname.startsWith(child.href))) {
        toExpand.add(item.href)
      }
    }
    if (toExpand.size > 0) {
      setExpandedItems((prev) => {
        const next = new Set(prev)
        for (const href of toExpand) next.add(href)
        return next
      })
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const isNavItemActive = (href: string) => {
    if (href === '/dashboard/people') return pathname === '/dashboard/people'
    if (href === '/dashboard/timecards') return pathname === '/dashboard/timecards'
    if (href === '/reports') return pathname === '/reports' || pathname.startsWith('/manager/reports')
    if (href === '/admin/clients') return pathname === '/admin/clients' || pathname.startsWith('/admin/clients/')
    if (href === '/service-reminders') return pathname === '/service-reminders'
    if (href === '/dashboard/quotes/service') return pathname.startsWith('/dashboard/quotes/service')
    if (href === '/dashboard/sales-engine') return pathname === '/dashboard/sales-engine'
    return pathname === href
  }

  const isChildActive = (childHref: string) => pathname.startsWith(childHref)

  const handleNavigation = (href: string) => {
    router.push(href)
    if (isMobile) onCloseMobile()
  }

  const toggleExpand = (href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  return (
    <>
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
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-slate-200 shrink-0 overflow-hidden ${
          isCollapsed && !isMobile ? 'justify-center px-2' : 'justify-start px-4'
        }`}>
          <div className="relative flex items-center justify-center min-w-[56px]">
            <img
              src="/NBE_LOGO_BK_PL.png"
              alt="NBE Australia"
              width={112}
              height={65}
              decoding="async"
              className="h-12 max-h-12 w-auto max-w-[min(160px,100%)] object-contain"
              style={{ maxHeight: '3rem', maxWidth: 'min(160px, 100%)', minWidth: '56px' }}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col py-2 px-2 overflow-hidden">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.href)
            const isDashboard = item.label === 'Dashboard'
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expandedItems.has(item.href)
            const anyChildActive = hasChildren && item.children!.some((c) => isChildActive(c.href))

            return (
              <div key={item.href}>
                {/* Parent item */}
                <div className="relative">
                  <button
                    onClick={() => {
                      if (hasChildren && !isCollapsed) {
                        // clicking the row navigates; chevron toggles
                        handleNavigation(item.href)
                      } else {
                        handleNavigation(item.href)
                      }
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-lg
                      transition-all duration-200 group relative
                      ${isActive || anyChildActive
                        ? 'bg-indigo-50 text-indigo-600 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                      }
                      ${isCollapsed && !isMobile ? 'justify-center' : ''}
                    `}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] shrink-0 ${
                        isActive || anyChildActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'
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

                    {/* Dashboard collapse toggle */}
                    {isDashboard && !isMobile && !isCollapsed && (
                      <span
                        onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleCollapse() }
                        }}
                        className="p-1 hover:bg-slate-200 rounded transition-all duration-300 cursor-pointer"
                        aria-label="Collapse sidebar"
                      >
                        <span className="material-symbols-outlined text-slate-600 text-[18px]">chevron_left</span>
                      </span>
                    )}

                    {/* Children chevron */}
                    {hasChildren && !isCollapsed && !isMobile && !isDashboard && (
                      <span
                        onClick={(e) => { e.stopPropagation(); toggleExpand(item.href) }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleExpand(item.href) }
                        }}
                        className="p-1 hover:bg-indigo-100 rounded cursor-pointer"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isActive || anyChildActive ? 'text-indigo-500' : 'text-slate-400'}`}>
                          expand_more
                        </span>
                      </span>
                    )}

                    {/* Tooltip when collapsed */}
                    {isCollapsed && !isMobile && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        {item.label}
                      </div>
                    )}
                  </button>

                  {/* Dashboard expand button when sidebar is collapsed */}
                  {isDashboard && !isMobile && isCollapsed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
                      className="absolute -right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition-colors z-50"
                      aria-label="Expand sidebar"
                    >
                      <span className="material-symbols-outlined text-slate-600 text-[16px]">chevron_right</span>
                    </button>
                  )}
                </div>

                {/* Child items */}
                {hasChildren && isExpanded && !isCollapsed && (
                  <div className="mb-0.5 ml-3 border-l-2 border-slate-100 pl-2">
                    {item.children!.map((child) => {
                      const childActive = isChildActive(child.href)
                      return (
                        <button
                          key={child.href}
                          onClick={() => handleNavigation(child.href)}
                          className={`
                            w-full flex items-center gap-2 px-2 py-2 mb-0.5 rounded-lg
                            transition-all duration-200 group
                            ${childActive
                              ? 'bg-indigo-50 text-indigo-600 font-semibold'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }
                          `}
                          aria-current={childActive ? 'page' : undefined}
                        >
                          <span
                            className={`material-symbols-outlined text-[17px] shrink-0 ${
                              childActive ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-600'
                            }`}
                          >
                            {child.icon}
                          </span>
                          <span className="text-xs whitespace-nowrap overflow-hidden">
                            {child.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Version badge */}
        <div className={`mt-auto px-4 py-3 border-t border-slate-100 ${isCollapsed && !isMobile ? 'flex justify-center' : ''}`}>
          {isCollapsed && !isMobile ? (
            <span className="text-[10px] font-mono text-slate-400" title={`v${pkg.version}`}>v</span>
          ) : (
            <span className="text-[11px] font-mono text-slate-400 select-none">v{pkg.version}</span>
          )}
        </div>
      </aside>
    </>
  )
}
