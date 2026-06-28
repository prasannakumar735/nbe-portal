import { NextResponse } from 'next/server'
import { isManagerOrAdmin } from '@/app/api/job-cards/helpers'
import { profileDisplayName } from '@/lib/auth/roles'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export async function GET() {
  try {
    const { supabase, user } = await requirePortalStaff()
    const admin = createServiceRoleClient()

    const { data, error } = await admin
      .from('profiles')
      .select('id, full_name, first_name, last_name, role, is_active')
      .eq('is_active', true)
      .neq('role', 'client')
      .order('full_name', { ascending: true })
      .limit(500)

    if (error) throw error

    const assignees = (data ?? []).map(row => {
      const name = profileDisplayName(row).trim() || String(row.id).slice(0, 8)
      return { id: row.id as string, name, role: row.role as string }
    })

    const isManager = await isManagerOrAdmin(supabase, user.id)

    return NextResponse.json({ assignees, isManager })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: 'Failed to load assignees.' }, { status: 400 })
  }
}
