/**
 * Role helpers – single source of truth: profiles.role
 *
 * Do NOT create new role tables. Always read role from the profiles table.
 *
 * Roles: "admin" | "manager" | "technician" | "employee" (legacy alias for technician)
 */

export type ProfileRole = 'admin' | 'manager' | 'technician' | 'employee' | 'client'

export type ProfileFromTable = {
  role?: string | null
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  is_active?: boolean | null
  /** Set when role is client — must match merged_reports.client_id */
  client_id?: string | null
}

/** True for manager or admin (maintenance approvals, timecard approvals, /manager routes). */
export function isManagerOrAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}

/**
 * Whether the user is an admin (from profiles.role).
 */
export function isAdmin(profile: ProfileFromTable | null | undefined): boolean {
  return profile?.role === 'admin'
}

/**
 * Whether the user is a manager (from profiles.role).
 */
export function isManager(profile: ProfileFromTable | null | undefined): boolean {
  return profile?.role === 'manager'
}

/**
 * Technician (or legacy "employee" role stored in DB).
 */
export function isTechnician(profile: ProfileFromTable | null | undefined): boolean {
  const r = profile?.role
  return r === 'technician' || r === 'employee'
}

/** External client org user — merged report viewer only. */
export function isClientRole(profile: ProfileFromTable | null | undefined): boolean {
  return profile?.role === 'client'
}

/**
 * @deprecated Use isTechnician — "employee" is a legacy role value meaning technician.
 */
export function isEmployee(profile: ProfileFromTable | null | undefined): boolean {
  return isTechnician(profile)
}

/**
 * Whether the user can approve maintenance reports (manager or admin).
 */
export function canApproveMaintenanceReport(profile: ProfileFromTable | null | undefined): boolean {
  return isManagerOrAdminRole(profile?.role)
}

/** Manager or admin may approve / reject employee weekly timesheets. */
export function canApproveTimesheet(profile: ProfileFromTable | null | undefined): boolean {
  return isManagerOrAdminRole(profile?.role)
}

/** Display name: full_name, or first + last, or empty. */
export function profileDisplayName(profile: ProfileFromTable | null | undefined): string {
  if (!profile) return ''
  const fn = (profile.full_name ?? '').trim()
  if (fn) return fn
  const a = (profile.first_name ?? '').trim()
  const b = (profile.last_name ?? '').trim()
  return [a, b].filter(Boolean).join(' ')
}

/**
 * Editing permission for maintenance reports:
 * - Admins and managers: can edit submitted/reviewing/approved reports.
 * - Employees: can edit only when report status is draft.
 */
export function canEditMaintenanceReport(
  profile: ProfileFromTable | null | undefined,
  reportStatus: string
): boolean {
  if (isAdmin(profile) || isManager(profile)) return true
  return reportStatus === 'draft'
}
