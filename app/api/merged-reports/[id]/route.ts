import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import { softDeleteMergedReport } from '@/lib/merged-reports/deleteMergedReport'

export const runtime = 'nodejs'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Alias path: DELETE /api/merged-reports/[id] — same behaviour as /api/maintenance/merged-reports/[mergedReportId] */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Merged report ID required' }, { status: 400 })
    }

    const serverSupabase = await createServerClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await serverSupabase.from('profiles').select('role').eq('id', user.id).single()

    if (!canApproveMaintenanceReport(profile as { role?: string } | null)) {
      return NextResponse.json({ error: 'Forbidden. Manager or admin only.' }, { status: 403 })
    }

    const supabase = createServiceClient()
    const result = await softDeleteMergedReport(supabase, id.trim(), user.id)

    if (!result.ok) {
      if (result.code === 'already_deleted') {
        return NextResponse.json({ error: 'Report already deleted' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Merged report not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete merged report'
    console.error('[DELETE /api/merged-reports/[id]]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
