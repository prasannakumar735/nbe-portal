import { isTechnicianRole } from '@/lib/auth/roles'
import type { FeatureFlags } from '@/lib/featureFlags'

export type PortalNavItem = {
  label: string
  icon: string
  href: string
  flagKey?: string
  children?: Array<{ label: string; icon: string; href: string }>
}

/** Full portal sidebar order for admin / manager / non-technician staff. */
export const PORTAL_NAV_ITEMS_ALL: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
  { label: 'Quote', icon: 'request_quote', href: '/dashboard/quotes/service', flagKey: 'nav_quote' },
  { label: 'Timecards', icon: 'schedule', href: '/dashboard/timecards', flagKey: 'nav_timecards' },
  { label: 'Maintenance Service', icon: 'build', href: '/maintenance', flagKey: 'nav_maintenance' },
  { label: 'QR Codes', icon: 'qr_code_2', href: '/qr-codes', flagKey: 'nav_qr_codes' },
  { label: 'Reimbursement', icon: 'payments', href: '/reimbursement', flagKey: 'nav_reimbursement' },
  { label: 'PVC Strip Calculator', icon: 'calculate', href: '/pvc-calculator', flagKey: 'nav_pvc_calculator' },
  { label: 'Shared Calendar', icon: 'calendar_today', href: '/calendar', flagKey: 'nav_calendar' },
  { label: 'Job Card & Client GPS', icon: 'location_on', href: '/job-card', flagKey: 'nav_job_card' },
  { label: 'Knowledge Share', icon: 'menu_book', href: '/knowledge', flagKey: 'nav_knowledge' },
  { label: 'Reports', icon: 'bar_chart', href: '/reports', flagKey: 'nav_reports' },
]

const ADMIN_EXTRA_NAV_ITEMS: PortalNavItem[] = [
  { label: 'People', icon: 'groups', href: '/dashboard/people' },
  {
    label: 'Sales Engine',
    icon: 'storefront',
    href: '/dashboard/sales-engine',
    flagKey: 'nav_sales_engine',
    children: [
      { label: 'SE Settings', icon: 'manage_accounts', href: '/dashboard/sales-engine/administration' },
      { label: 'Tools', icon: 'build_circle', href: '/dashboard/sales-engine/tools' },
    ],
  },
  { label: 'Service reminders', icon: 'notifications_active', href: '/service-reminders', flagKey: 'nav_service_reminders' },
  { label: 'Inventory', icon: 'inventory_2', href: '/admin/inventory', flagKey: 'nav_inventory' },
  { label: 'Clients', icon: 'domain', href: '/admin/clients' },
  { label: 'Portal Settings', icon: 'settings', href: '/admin/settings' },
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

function applyFeatureFlags(items: PortalNavItem[], flags: FeatureFlags): PortalNavItem[] {
  return items.filter((item) => {
    if (!item.flagKey) return true
    return flags[item.flagKey] !== false
  })
}

export function buildPortalSidebarNavItems(
  role: string | null | undefined,
  managerOrAdmin: boolean,
  flags: FeatureFlags = {},
): PortalNavItem[] {
  const base = isTechnicianRole(role) ? TECHNICIAN_NAV_ITEMS : PORTAL_NAV_ITEMS_ALL
  const all = managerOrAdmin ? [...base, ...ADMIN_EXTRA_NAV_ITEMS] : base
  return applyFeatureFlags(all, flags)
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
