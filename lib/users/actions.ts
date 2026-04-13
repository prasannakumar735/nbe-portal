'use server'

import { randomBytes } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import type { CreateUserResult, ManagedUserRow, UserManagementActionResult } from '@/lib/types/user-management.types'
import { requireManagerOrAdmin } from '@/lib/users/staff'

function generateTempPassword(): string {
  const part = randomBytes(18).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  return `Nbe-${part}1!`
}

async function fetchAllAuthEmails(): Promise<Map<string, string>> {
  const admin = createServiceRoleClient()
  const map = new Map<string, string>()
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    for (const u of data.users) {
      map.set(u.id, u.email ?? '')
    }
    if (data.users.length < perPage) break
    page += 1
  }
  return map
}

export async function getUsers(): Promise<{ users: ManagedUserRow[]; error?: string }> {
  const gate = await requireManagerOrAdmin()
  if (!gate.ok) {
    return { users: [], error: gate.error }
  }

  try {
    const service = createServiceRoleClient()
    const { data: rows, error } = await service
      .from('profiles')
      .select('id, full_name, role, phone, is_active, created_at, updated_at')
      .neq('role', 'client')
      .order('created_at', { ascending: false })

    if (error) {
      return { users: [], error: error.message }
    }

    const emails = await fetchAllAuthEmails()

    const users: ManagedUserRow[] = (rows ?? []).map((r) => ({
      id: r.id,
      full_name: r.full_name,
      email: emails.get(r.id) ?? '',
      role: r.role ?? 'technician',
      phone: r.phone,
      is_active: r.is_active ?? true,
      created_at: r.created_at ?? new Date().toISOString(),
      updated_at: r.updated_at ?? new Date().toISOString(),
    }))

    return { users }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load users'
    return { users: [], error: msg }
  }
}

export async function createUser(input: {
  fullName: string
  email: string
  role: 'admin' | 'manager' | 'technician'
}): Promise<CreateUserResult> {
  const gate = await requireManagerOrAdmin()
  if (!gate.ok) {
    return { ok: false, error: gate.error }
  }

  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  if (!email || !fullName) {
    return { ok: false, error: 'Name and email are required' }
  }

  const admin = createServiceRoleClient()
  const tempPassword = generateTempPassword()

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createErr || !created.user) {
    return { ok: false, error: createErr?.message ?? 'Could not create user' }
  }

  const userId = created.user.id

  const { error: profileErr } = await admin.from('profiles').insert({
    id: userId,
    full_name: fullName,
    role: input.role,
    is_active: true,
    phone: null,
  })

  if (profileErr) {
    await admin.auth.admin.deleteUser(userId)
    return { ok: false, error: profileErr.message }
  }

  return { ok: true, tempPassword, userId }
}

async function countActiveAdmins(service: ReturnType<typeof createServiceRoleClient>): Promise<number> {
  const { count, error } = await service
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function updateUser(input: {
  userId: string
  fullName: string
  role: 'admin' | 'manager' | 'technician'
}): Promise<UserManagementActionResult> {
  const gate = await requireManagerOrAdmin()
  if (!gate.ok) {
    return { ok: false, error: gate.error }
  }

  const fullName = input.fullName.trim()
  if (!fullName) {
    return { ok: false, error: 'Name is required' }
  }

  const service = createServiceRoleClient()
  const supabase = await createServerClient()

  const { data: target, error: readErr } = await service
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', input.userId)
    .maybeSingle()

  if (readErr || !target) {
    return { ok: false, error: 'User not found' }
  }

  if (target.role === 'admin' && input.role !== 'admin' && target.is_active) {
    const admins = await countActiveAdmins(service)
    if (admins <= 1) {
      return { ok: false, error: 'Cannot remove the last active administrator' }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      role: input.role,
    })
    .eq('id', input.userId)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function toggleUserStatus(userId: string): Promise<UserManagementActionResult> {
  const gate = await requireManagerOrAdmin()
  if (!gate.ok) {
    return { ok: false, error: gate.error }
  }

  if (userId === gate.userId) {
    return { ok: false, error: 'You cannot change your own active status' }
  }

  const service = createServiceRoleClient()
  const supabase = await createServerClient()

  const { data: row, error: readErr } = await service
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (readErr || !row) {
    return { ok: false, error: 'User not found' }
  }

  const nextActive = !row.is_active

  if (row.role === 'admin' && row.is_active && !nextActive) {
    const admins = await countActiveAdmins(service)
    if (admins <= 1) {
      return { ok: false, error: 'Cannot deactivate the last active administrator' }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: nextActive })
    .eq('id', userId)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function updateOwnProfile(input: {
  fullName: string
  phone: string
}): Promise<UserManagementActionResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'Not authenticated' }
  }

  const fullName = input.fullName.trim()
  const phone = input.phone.trim() || null

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
    })
    .eq('id', user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
