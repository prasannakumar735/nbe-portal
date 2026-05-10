'use client'

import { ReactNode, useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface LayoutWrapperProps {
  children: ReactNode
  user: any
  /** Server-resolved profiles.role for navigation (avoids client flash). */
  portalRole: string | null
  portalManagerOrAdmin: boolean
}

/**
 * LayoutWrapper - Sidebar layout for the portal
 * 
 * Simple, clean structure:
 * - Fixed sidebar on left (collapsible on desktop, slide-in on mobile)
 * - Header on top with profile in top-right
 * - Main content area that scrolls
 * 
 * Features:
 * - Responsive design with mobile slide-in drawer
 * - SSR compatible
 * - Works with existing auth flow
 * - Dynamic content area adjustment based on sidebar state
 */
export function LayoutWrapper({ children, user, portalRole, portalManagerOrAdmin }: LayoutWrapperProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  const handleToggleMobile = () => {
    setIsMobileOpen(!isMobileOpen)
  }

  const handleCloseMobile = () => {
    setIsMobileOpen(false)
  }

  // Calculate sidebar width based on state (72px collapsed, 240px expanded)
  const sidebarWidth = isMobile ? 0 : (isCollapsed ? 72 : 240)
  
  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-50">
      {/* Mobile Overlay */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={handleCloseMobile}
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={handleCloseMobile}
        portalRole={portalRole}
        portalManagerOrAdmin={portalManagerOrAdmin}
      />
      
      {/* Main Content Area - Dynamically adjusts based on sidebar state */}
      <div 
        className="flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300"
        style={{ 
          marginLeft: isMobile ? '0px' : `${sidebarWidth}px`
        }}
      >
        {/* Header with Profile */}
        <Header
          user={user}
          mobileMenu={
            isMobile ? { isOpen: isMobileOpen, onToggle: handleToggleMobile } : null
          }
        />

        {/* Page content: full width of main column (forms/pages can cap themselves if needed) */}
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="w-full min-w-0 px-4 py-5 lg:px-6 xl:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}


