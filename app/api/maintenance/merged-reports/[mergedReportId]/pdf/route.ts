import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import { mergeMaintenanceReportPdfs } from '@/lib/pdf/mergeMaintenanceReportPdfs'
import { assertValidPdfSignature } from '@/lib/pdf/savePdf'
import { createPdfBinaryResponse } from '@/lib/http/pdfBinaryResponse'
import { loadMaintenanceReportDraftPayload } from '@/lib/maintenance/loadMaintenanceReportDraftPayload'
import { MERGED_MAINTENANCE_REPORTS_BUCKET } from '@/lib/merged-reports/storage'

export const runtime = 'nodejs'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function sanitizeFilenamePart(input: string): string {
  return String(input ?? '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'Client'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mergedReportId: string }> },
) {
  try {
    const { mergedReportId } = await params
    if (!mergedReportId) {
      return NextResponse.json({ error: 'Merged report ID required' }, { status: 400 })
    }

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

    const supabase = createServiceClient()

    const { data: mergedRow, error: mergedErr } = await supabase
      .from('merged_reports')
      .select(
        'id, client_id, client_name, report_ids, created_at, total_doors_inspected, created_by, deleted_at, pdf_storage_path',
      )
      .eq('id', mergedReportId)
      .single()

    if (mergedErr) {
      if (mergedErr.code === 'PGRST116') {
        return NextResponse.json({ error: 'Merged report not found' }, { status: 404 })
      }
      return NextResponse.json({ error: mergedErr.message }, { status: 500 })
    }

    if ((mergedRow as { deleted_at?: string | null }).deleted_at) {
      return NextResponse.json({ error: 'Merged report not available' }, { status: 404 })
    }

    const reportIds = (mergedRow?.report_ids ?? []) as string[]
    if (!Array.isArray(reportIds) || reportIds.length < 2) {
      return NextResponse.json({ error: 'Merged report has no report IDs' }, { status: 400 })
    }

    const storagePath = String(
      (mergedRow as { pdf_storage_path?: string | null }).pdf_storage_path ?? '',
    ).trim()

    const sp = request.nextUrl.searchParams
    const preferInline =
      sp.get('inline') === '1' || sp.get('download') === '0' || sp.get('view') === '1'

    const clientNameFromRow = String(
      (mergedRow as { client_name?: string | null }).client_name ?? '',
    ).trim()
    const { data: clientRow } = mergedRow.client_id
      ? await supabase.from('clients').select('name').eq('id', mergedRow.client_id).maybeSingle()
      : { data: null as null | { name?: string | null } }

    const clientNameForFile =
      clientNameFromRow || String(clientRow?.name ?? '').trim() || 'Client'
    const dateLabel = new Date(String(mergedRow.created_at ?? '') || Date.now()).toISOString().slice(0, 10)
    const resolvedFilename = `Merged_Report_${sanitizeFilenamePart(clientNameForFile)}_${dateLabel}.pdf`

    if (storagePath) {
      const { data: storedBlob, error: dlErr } = await supabase.storage
        .from(MERGED_MAINTENANCE_REPORTS_BUCKET)
        .download(storagePath)

      if (!dlErr && storedBlob) {
        const buf = Buffer.from(await storedBlob.arrayBuffer())
        try {
          assertValidPdfSignature(new Uint8Array(buf), 'merged PDF from storage')
          return createPdfBinaryResponse(buf, {
            contentDisposition: preferInline
              ? `inline; filename="${resolvedFilename}"`
              : `attachment; filename="${resolvedFilename}"`,
          })
        } catch {
          // Regenerate below if stored file is corrupt
        }
      }
    }

    const drafts = (
      await Promise.all(
        reportIds.map(async reportId => {
          const report = await loadMaintenanceReportDraftPayload(supabase, reportId)
          return report ? { reportId, report } : null
        }),
      )
    ).filter((x): x is { reportId: string; report: Record<string, unknown> } => x !== null)

    if (drafts.length < 2) {
      return NextResponse.json({ error: 'Not enough valid reports to merge' }, { status: 400 })
    }

    const clientIds = drafts
      .map(d => String(d.report.client_id ?? '').trim())
      .filter(Boolean)
    const uniqueClientIds = Array.from(new Set(clientIds))
    if (uniqueClientIds.length !== 1 || (mergedRow.client_id && uniqueClientIds[0] !== mergedRow.client_id)) {
      return NextResponse.json({ error: 'Only reports from same client can be merged' }, { status: 400 })
    }

    const preparedOn = new Date(String(mergedRow.created_at ?? Date.now())).toISOString().slice(0, 10)

    let pdfBytes: Uint8Array
    try {
      pdfBytes = await mergeMaintenanceReportPdfs({
        supabase,
        drafts,
        signatureDateLabel: preparedOn,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to merge PDFs'
      if (msg === 'No mergeable reports found') {
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      throw e
    }
    assertValidPdfSignature(pdfBytes, 'GET merged-reports pdf')

    return createPdfBinaryResponse(pdfBytes, {
      contentDisposition: preferInline
        ? `inline; filename="${resolvedFilename}"`
        : `attachment; filename="${resolvedFilename}"`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate merged PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

