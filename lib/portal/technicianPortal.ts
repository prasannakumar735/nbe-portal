import { isTechnicianRole } from '@/lib/auth/roles'

export type PortalNavItem = { label: string; icon: string; href: string }

/** Full portal sidebar order for admin / manager / non-technician staff. */
export const PORTAL_NAV_ITEMS_ALL: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
  { label: 'Quote', icon: 'request_quote', href: '/dashboard/quotes/service' },
  { label: 'Timecards', icon: 'schedule', href: '/dashboard/timecards' },
  { label: 'Maintenance Service', icon: 'build', href: '/maintenance' },
  { label: 'QR Codes', icon: 'qr_code_2', href: '/qr-codes' },
  { label: 'Reimbursement', icon: 'payments', href: '/reimbursement' },
  { label: 'PVC Strip Calculator', icon: 'calculate', href: '/pvc-calculator' },
  { label: 'Shared Calendar', icon: 'calendar_today', href: '/calendar' },
  { label: 'Job Card & Client GPS', icon: 'location_on', href: '/job-card' },
  { label: 'Knowledge Share', icon: 'menu_book', href: '/knowledge' },
  { label: 'Reports', icon: 'bar_chart', href: '/reports' },
]

const ADMIN_EXTRA_NAV_ITEMS: PortalNavItem[] = [
  { label: 'People', icon: 'groups', href: '/dashboard/people' },
  { label: 'Inventory', icon: 'inventory_2', href: '/admin/inventory' },
  { label: 'Clients', icon: 'domain', href: '/admin/clients' },
]

/** Technician (and legacy employee): dashboard, timecards, maintenance, reimbursement, calendar, job card, knowledge. */
const TECHNICIAN_HREF_ORDER = [
  '/dashboard',
  '/dashboard/timecards',
  '/maintenance',
  '/reimbursement',
  '/calendar',
  '/job-card',
  '/knowledge',
] as const

const TECHNICIAN_NAV_ITEMS: PortalNavItem[] = TECHNICIAN_HREF_ORDER.map((href) => {
  const item = PORTAL_NAV_ITEMS_ALL.find((n) => n.href === href)
  if (!item) throw new Error(`[technicianPortal] Missing nav item for ${href}`)
  return item
})

export function buildPortalSidebarNavItems(
  role: string | null | undefined,
  managerOrAdmin: boolean,
): PortalNavItem[] {
  const base = isTechnicianRole(role) ? TECHNICIAN_NAV_ITEMS : PORTAL_NAV_ITEMS_ALL
  return managerOrAdmin ? [...base, ...ADMIN_EXTRA_NAV_ITEMS] : base
}

function normalizePortalPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

/**
 * URL paths technicians may open. Keeps account pages under /dashboard that are not module shortcuts.
 */
const TECHNICIAN_ALLOWED_PREFIXES = [
  '/dashboard/timecards',
  '/dashboard/profile',
  '/dashboard/security',
  '/dashboard/change-password',
  '/maintenance',
  '/reimbursement',
  '/calendar',
  '/job-card',
  '/knowledge',
  '/timecard',
  '/office',
] as const

/** Whether a pathname is allowed for technician / legacy employee portal users. */
export function isTechnicianPortalPathAllowed(pathname: string): boolean {
  const p = normalizePortalPathname(pathname)
  if (p === '/dashboard') return true
  return TECHNICIAN_ALLOWED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))
}
