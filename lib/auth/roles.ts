/**
 * Role helpers – single source of truth: profiles.role
 *
 * Do NOT create new role tables. Always read role from the profiles table.
 * Example: select role from profiles where id = auth.uid()
 *
 * Roles: "admin" | "manager" | "employee"
 * - admin = admin user
 * - manager = can view, edit, approve maintenance reports
 * - employee = technician
 */

export type ProfileRole = 'admin' | 'manager' | 'employee'

export type ProfileFromTable = {
  role?: string | null
  first_name?: string | null
  last_name?: string | null
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
 * Whether the user is an employee/technician (from profiles.role).
 */
export function isEmployee(profile: ProfileFromTable | null | undefined): boolean {
  return profile?.role === 'employee'
}

/**
 * Whether the user can approve maintenance reports (manager or admin).
 */
export function canApproveMaintenanceReport(profile: ProfileFromTable | null | undefined): boolean {
  return isAdmin(profile) || isManager(profile)
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
