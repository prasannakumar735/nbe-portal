import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { canApproveMaintenanceReport, isTechnician } from '@/lib/auth/roles'
import { regenerateMaintenanceReportPdfWithClientQr } from '@/lib/maintenance/regenerateReportPdfWithQr'
import { maintenanceReportClientViewUrl } from '@/lib/app/publicAppBaseUrl'
import { notifyTechnicianOfReportApproval } from '@/lib/maintenance/reportWorkflowEmail'
import { deleteMaintenanceReportStorageAssets } from '@/lib/maintenance/deleteMaintenanceReportStorage'
import { jsonError500 } from '@/lib/security/safeApiError'

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

    const priorStatus = String((existing as { status?: string | null }).status ?? '').trim()
    if (priorStatus === 'approved') {
      return NextResponse.json({ error: 'Report already approved.' }, { status: 409 })
    }
    if (priorStatus !== 'submitted' && priorStatus !== 'reviewing') {
      return NextResponse.json(
        { error: 'Only submitted reports can be approved.' },
        { status: 400 },
      )
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
      console.error('[approve report] DB update', error)
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === 'production' ? 'Could not update report.' : error.message,
        },
        { status: 500 },
      )
    }

    let technicianApprovalEmail: { status: string; detail?: string } = { status: 'skipped' }
    try {
      const approvalNotify = await notifyTechnicianOfReportApproval(supabase, reportId, shareToken)
      if (approvalNotify.status === 'failed') {
        technicianApprovalEmail = { status: 'failed', detail: approvalNotify.error }
        console.error('[approve report] Technician approval email failed', approvalNotify.error)
      } else if (approvalNotify.status === 'skipped') {
        technicianApprovalEmail = { status: 'skipped', detail: approvalNotify.reason }
      } else {
        technicianApprovalEmail = { status: 'sent' }
      }
    } catch (e) {
      technicianApprovalEmail = {
        status: 'failed',
        detail:
          process.env.NODE_ENV === 'production'
            ? 'Email could not be sent.'
            : e instanceof Error
              ? e.message
              : String(e),
      }
      console.error('[approve report] Technician approval email error', e)
    }

    let pdfRegen: { pdf_url?: string; error?: string } = {}
    try {
      const regen = await regenerateMaintenanceReportPdfWithClientQr({
        supabase,
        reportId,
        shareToken,
      })
      if ('error' in regen) {
        pdfRegen = {
          error:
            process.env.NODE_ENV === 'production'
              ? 'PDF update failed.'
              : regen.error,
        }
      } else {
        pdfRegen = { pdf_url: regen.pdf_url }
      }
    } catch (e) {
      pdfRegen = {
        error:
          process.env.NODE_ENV === 'production'
            ? 'PDF regeneration failed.'
            : e instanceof Error
              ? e.message
              : 'PDF regeneration failed',
      }
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
      technician_approval_email: technicianApprovalEmail,
      pdf_regeneration: pdfRegen,
    })
  } catch (err) {
    return jsonError500(err, 'maintenance-approve-report')
  }
}

function emailsMatchReport(
  userEmail: string,
  row: { technician_email?: string | null; submitter_email?: string | null },
): boolean {
  const u = userEmail.trim().toLowerCase()
  const te = String(row.technician_email ?? '')
    .trim()
    .toLowerCase()
  const se = String(row.submitter_email ?? '')
    .trim()
    .toLowerCase()
  return Boolean(u && (te === u || se === u))
}

/**
 * Delete a maintenance report and related storage. Managers/admins: any report.
 * Technicians: only if their auth email matches technician_email or submitter_email on the row.
 * Blocked if the report id is still referenced by a non–soft-deleted merged report.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const serverSupabase = await createServerClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isManager = canApproveMaintenanceReport(profile as { role?: string } | null)
    const isTech = isTechnician(profile as { role?: string } | null)

    const { reportId } = await params
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: row, error: loadErr } = await supabase
      .from('maintenance_reports')
      .select('id, technician_email, submitter_email')
      .eq('id', reportId)
      .maybeSingle()

    if (loadErr || !row) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (!isManager) {
      if (!isTech) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
      }
      if (!emailsMatchReport(user.email, row)) {
        return NextResponse.json(
          { error: 'You can only delete maintenance reports linked to your account email.' },
          { status: 403 },
        )
      }
    }

    const { data: mergedBlock } = await supabase
      .from('merged_reports')
      .select('id')
      .is('deleted_at', null)
      .contains('report_ids', [reportId])
      .limit(1)
      .maybeSingle()

    if (mergedBlock) {
      return NextResponse.json(
        {
          error:
            'This report is included in a merged PDF. Remove it from merged reports (or delete the merged report) before deleting.',
        },
        { status: 409 },
      )
    }

    await deleteMaintenanceReportStorageAssets(supabase, reportId)

    const { error: delErr } = await supabase.from('maintenance_reports').delete().eq('id', reportId)

    if (delErr) {
      console.error('[DELETE maintenance report]', delErr)
      return NextResponse.json(
        { error: process.env.NODE_ENV === 'production' ? 'Could not delete report.' : delErr.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return jsonError500(err, 'maintenance-delete-report')
  }
}
