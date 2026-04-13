import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import { regenerateMaintenanceReportPdfWithClientQr } from '@/lib/maintenance/regenerateReportPdfWithQr'
import { maintenanceReportClientViewUrl } from '@/lib/app/publicAppBaseUrl'

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

    const { data: existing, error: loadErr } = await supabase
      .from('maintenance_reports')
      .select('id, status, share_token, client_location_id')
      .eq('id', reportId)
      .maybeSingle()

    if (loadErr || !existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const locId = String((existing as { client_location_id?: string | null }).client_location_id ?? '').trim()
    if (!locId) {
      return NextResponse.json(
        { error: 'Report has no site / client location; assign a location before approving for client access.' },
        { status: 400 },
      )
    }

    const shareToken = String((existing as { share_token?: string | null }).share_token ?? '').trim() || randomUUID()
    const approvedAt = new Date().toISOString()

    const { data: report, error } = await supabase
      .from('maintenance_reports')
      .update({
        status: 'approved',
        approved: true,
        approved_at: approvedAt,
        share_token: shareToken,
      })
      .eq('id', reportId)
      .select('id, status, share_token, approved')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let pdfRegen: { pdf_url?: string; error?: string } = {}
    try {
      const regen = await regenerateMaintenanceReportPdfWithClientQr({
        supabase,
        reportId,
        shareToken,
      })
      if ('error' in regen) {
        pdfRegen = { error: regen.error }
      } else {
        pdfRegen = { pdf_url: regen.pdf_url }
      }
    } catch (e) {
      pdfRegen = { error: e instanceof Error ? e.message : 'PDF regeneration failed' }
    }

    const tokenOut = String((report as { share_token?: string }).share_token ?? '').trim()

    return NextResponse.json({
      report: {
        id: report.id,
        status: report.status,
        share_token: (report as { share_token?: string }).share_token,
        approved: (report as { approved?: boolean }).approved,
      },
      client_view_url: maintenanceReportClientViewUrl(tokenOut),
      pdf_regeneration: pdfRegen,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to approve report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
