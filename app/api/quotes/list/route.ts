import { NextRequest, NextResponse } from 'next/server'
import { requirePortalStaff } from '@/lib/security/requirePortalStaff'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export async function GET(request: NextRequest) {
  try {
    await requirePortalStaff()
    const supabase = createServiceRoleClient()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, quote_kind, customer_name, site_address, service_date, total, workflow_status, updated_at, form_snapshot')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ ok: true, data: data ?? [] })
  } catch (error) {
    const auth = unauthorizedOrForbiddenResponse(error)
    if (auth) return auth
    const message = error instanceof Error ? error.message : 'Failed to load quotes.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
