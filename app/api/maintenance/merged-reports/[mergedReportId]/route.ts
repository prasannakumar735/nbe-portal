import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import { softDeleteMergedReport } from '@/lib/merged-reports/deleteMergedReport'
import { jsonError500 } from '@/lib/security/safeApiError'

export const runtime = 'nodejs'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ mergedReportId: string }> },
) {
  try {
    const { mergedReportId } = await params
    if (!mergedReportId?.trim()) {
      return NextResponse.json({ error: 'Merged report ID required' }, { status: 400 })
    }

    const serverSupabase = await createServerClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()
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

    const body = await request.json().catch(() => ({})) as { status?: string }
    if (body.status !== 'approved') {
      return NextResponse.json({ error: 'Only status "approved" is allowed' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: existing, error: loadErr } = await supabase
      .from('merged_reports')
      .select('id, approved, deleted_at')
      .eq('id', mergedReportId.trim())
      .maybeSingle()

    if (loadErr || !existing) {
      return NextResponse.json({ error: 'Merged report not found' }, { status: 404 })
    }

    if ((existing as { deleted_at?: string | null }).deleted_at) {
      return NextResponse.json({ error: 'Merged report has been deleted' }, { status: 409 })
    }

    if ((existing as { approved?: boolean | null }).approved === true) {
      return NextResponse.json({ error: 'Merged report is already approved' }, { status: 409 })
    }

    const approvedAt = new Date().toISOString()

    const { data: updated, error: updateErr } = await supabase
      .from('merged_reports')
      .update({
        status: 'approved',
        approved: true,
        approved_at: approvedAt,
      })
      .eq('id', mergedReportId.trim())
      .select('id, status, approved, approved_at, pdf_url')
      .single()

    if (updateErr) {
      console.error('[PATCH merged-reports approve]', updateErr)
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === 'production'
              ? 'Could not approve merged report.'
              : updateErr.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      merged_report: {
        id: (updated as { id: string }).id,
        status: (updated as { status: string }).status,
        approved: (updated as { approved: boolean }).approved,
        approved_at: (updated as { approved_at: string }).approved_at,
      },
      client_view_url: (updated as { pdf_url?: string | null }).pdf_url ?? null,
    })
  } catch (err) {
    return jsonError500(err, 'maintenance-approve-merged-report')
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ mergedReportId: string }> },
) {
  try {
    const { mergedReportId } = await params
    if (!mergedReportId?.trim()) {
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
    const result = await softDeleteMergedReport(supabase, mergedReportId.trim(), user.id)

    if (!result.ok) {
      if (result.code === 'already_deleted') {
        return NextResponse.json({ error: 'Report already deleted' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Merged report not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete merged report'
    console.error('[DELETE merged-reports]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
