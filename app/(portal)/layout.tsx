import { RouteGuard } from './components/DashboardGuard'
import { LayoutWrapper } from './components/LayoutWrapper'
import { getServerUser } from '@/lib/auth/server'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Layout for all protected routes inside (portal) group
 * 
 * This layout wraps all routes in (portal) with:
 * 1. RouteGuard - checks authentication before rendering any content
 * 2. LayoutWrapper - switches between top-nav and sidebar layouts
 * 
 * Routes protected:
 * - /dashboard
 * - /dashboard/timecards (unified timecard + team approvals)
 * - /reimbursement
 * - /calendar
 * 
 * LAYOUT SWITCHING:
 * - Change LAYOUT_CONFIG.mode in lib/config/layout.config.ts
 * - Switch between "top-nav" (horizontal) and "sidebar" (left sidebar)
 * - No need to modify page components
 * 
 * CRITICAL:
 * - RouteGuard uses AuthProvider context (set at root)
 * - Session is shared across all these routes
 * - User can navigate between them without re-authentication
 */

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get user for the layout wrapper (needed for nav display)
  // This runs on the server, so it's safe and won't cause hydration issues
  const user = await getServerUser()
  
  if (!user) {
    redirect('/login')
  }

  const supabase = await createServerClient()
  const { data: portalProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (portalProfile?.role === 'client') {
    redirect('/client')
  }

  return (
    <RouteGuard>
      <LayoutWrapper user={user}>
        {children}
      </LayoutWrapper>
    </RouteGuard>
  )
}
