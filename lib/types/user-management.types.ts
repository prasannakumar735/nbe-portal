export type PortalStaffRole = 'admin' | 'manager' | 'technician'

export type ManagedUserRow = {
  id: string
  full_name: string | null
  email: string
  role: string
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type UserManagementActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type CreateUserResult =
  | { ok: true; tempPassword: string; userId: string }
  | { ok: false; error: string }
