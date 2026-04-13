import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { maintenanceReportClientViewUrl } from '@/lib/app/publicAppBaseUrl'
import { generateMaintenanceReportPdf } from '@/lib/pdf/generateMaintenanceReportPdf'
import { assertValidPdfSignature } from '@/lib/pdf/savePdf'
import { buildMaintenancePdfOptions } from '@/lib/pdf/buildMaintenancePdfOptions'
import { createPdfBinaryResponse } from '@/lib/http/pdfBinaryResponse'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'

export const runtime = 'nodejs'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }

    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    /** Same-origin draft fetch — do not use NEXT_PUBLIC_APP_URL (wrong host breaks cookies / returns HTML). */
    const draftRes = await fetch(
      new URL(`/api/maintenance/draft?reportId=${encodeURIComponent(reportId)}`, _request.nextUrl).toString(),
      {
        headers: {
          cookie: _request.headers.get('cookie') ?? '',
        },
      },
    )
    const draftData = await draftRes.json()
    if (!draftRes.ok || !draftData.report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const report = draftData.report as Record<string, unknown>
    const form: MaintenanceFormValues = {
      report_id: report.report_id as string | undefined,
      technician_name: String(report.technician_name ?? ''),
      submission_date: String(report.submission_date ?? ''),
      source_app: String(report.source_app ?? 'Portal'),
      client_id: String(report.client_id ?? ''),
      client_location_id: String(report.client_location_id ?? ''),
      address: String(report.address ?? ''),
      inspection_date: String(report.inspection_date ?? ''),
      inspection_start: String(report.inspection_start ?? ''),
      inspection_end: String(report.inspection_end ?? ''),
      total_doors: Number(report.total_doors ?? 1),
      notes: String(report.notes ?? ''),
      signature_data_url: '',
      signature_storage_url: String(report.signature_storage_url ?? ''),
      doors: Array.isArray(report.doors)
        ? (report.doors as MaintenanceFormValues['doors'])
        : [],
    }

    const supabase = createServiceClient()
    const pdfOptions = await buildMaintenancePdfOptions({ form, reportId, supabase })

    const { data: shareRow } = await supabase
      .from('maintenance_reports')
      .select('status, approved, share_token')
      .eq('id', reportId)
      .maybeSingle()

    const shareToken = String((shareRow as { share_token?: string | null } | null)?.share_token ?? '').trim()
    const rowStatus = String((shareRow as { status?: string | null } | null)?.status ?? '').trim()
    const rowApproved = Boolean((shareRow as { approved?: boolean | null } | null)?.approved)
    const isApprovedForClient = rowStatus === 'approved' && rowApproved && Boolean(shareToken)

    if (isApprovedForClient) {
      const viewerUrl = maintenanceReportClientViewUrl(shareToken)
      if (viewerUrl) {
        try {
          const buf = await QRCode.toBuffer(viewerUrl, {
            type: 'png',
            width: 240,
            margin: 1,
            errorCorrectionLevel: 'M',
          })
          pdfOptions.coverQrPngBytes = new Uint8Array(buf)
        } catch {
          // PDF still valid without QR if generation fails
        }
      }
    }

    const pdfBytes = await generateMaintenanceReportPdf(pdfOptions)
    assertValidPdfSignature(pdfBytes, 'GET maintenance pdf')

    const filename = `maintenance-report-${pdfOptions.reportNumber}.pdf`

    return createPdfBinaryResponse(pdfBytes, {
      contentDisposition: `attachment; filename="${filename}"`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
