import { NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export const runtime = 'nodejs'

/**
 * GET /api/pvc/quotes/my-job-cards
 * Returns PVC quotes that are approved/shipped and assigned to the current user,
 * plus all approved quotes for managers.
 */
export async function GET() {
  try {
    const staff = await requirePortalStaff()
    const supabase = createServiceRoleClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', staff.user.id)
      .maybeSingle()

    const role = String((profile as { role?: string } | null)?.role ?? '').toLowerCase()
    const isManager = role === 'manager' || role === 'admin'

    let query = supabase
      .from('pvc_quotes')
      .select('id, customer_name, ref_no, workflow_status, job_card_created_at, job_card_supply_scope, assigned_user_id, approval_po_reference, approval_message, form_snapshot')
      .in('workflow_status', ['approved', 'shipped_or_installed'])
      .order('job_card_created_at', { ascending: false })
      .limit(100)

    if (!isManager) {
      query = query.eq('assigned_user_id', staff.user.id)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ quotes: data ?? [], isManager })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to load job cards'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
