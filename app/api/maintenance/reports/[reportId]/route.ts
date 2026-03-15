import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'

export const runtime = 'nodejs'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!canApproveMaintenanceReport(profile as { role?: string } | null)) {
      return NextResponse.json({ error: 'Forbidden. Manager or admin only.' }, { status: 403 })
    }

    const { reportId } = await params
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }

    const body = await _request.json().catch(() => ({})) as { status?: string }
    if (body.status !== 'approved') {
      return NextResponse.json({ error: 'Only status "approved" is allowed' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: report, error } = await supabase
      .from('maintenance_reports')
      .update({ status: 'approved' })
      .eq('id', reportId)
      .select('id, status')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ report: { id: report.id, status: report.status } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to approve report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
