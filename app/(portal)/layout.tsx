import { RouteGuard } from './components/DashboardGuard'

/**
 * Layout for all protected routes inside (portal) group
 * 
 * This layout wraps all routes in (portal) with RouteGuard
 * which checks authentication before rendering any content.
 * 
 * Routes protected:
 * - /dashboard
 * - /timecard
 * - /reimbursement
 * - /calendar
 * 
 * CRITICAL:
 * - RouteGuard uses AuthProvider context (set at root)
 * - Session is shared across all these routes
 * - User can navigate between them without re-authentication
 */

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RouteGuard>{children}</RouteGuard>
}
