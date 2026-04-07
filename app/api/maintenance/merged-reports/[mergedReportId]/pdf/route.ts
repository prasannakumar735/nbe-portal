import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import { generateMaintenanceReportPdf } from '@/lib/pdf/generateMaintenanceReportPdf'
import { buildMaintenancePdfOptions } from '@/lib/pdf/buildMaintenancePdfOptions'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import { PDFDocument } from 'pdf-lib'

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
      .select('id, client_id, report_ids, created_at')
      .eq('id', mergedReportId)
      .single()

    if (mergedErr) {
      if (mergedErr.code === 'PGRST116') {
        return NextResponse.json({ error: 'Merged report not found' }, { status: 404 })
      }
      return NextResponse.json({ error: mergedErr.message }, { status: 500 })
    }

    const reportIds = (mergedRow?.report_ids ?? []) as string[]
    if (!Array.isArray(reportIds) || reportIds.length < 2) {
      return NextResponse.json({ error: 'Merged report has no report IDs' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
    const cookie = request.headers.get('cookie') ?? ''

    const draftResponses = await Promise.all(
      reportIds.map(async (reportId) => {
        const res = await fetch(
          `${baseUrl}/api/maintenance/draft?reportId=${encodeURIComponent(reportId)}`,
          { headers: { cookie } }
        )
        const data = await res.json().catch(() => ({}))
        return { reportId, ok: res.ok, data }
      })
    )

    const drafts = draftResponses
      .map(r => ({ reportId: r.reportId, report: (r.data as { report?: unknown }).report }))
      .filter(r => r.report && typeof r.report === 'object') as Array<{ reportId: string; report: Record<string, unknown> }>

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

    const { data: mergedNameRow } = await supabase
      .from('merged_reports')
      .select('client_name')
      .eq('id', mergedReportId)
      .maybeSingle()

    const clientNameFromMerged = String((mergedNameRow as { client_name?: string | null } | null)?.client_name ?? '').trim()

    const { data: client } = mergedRow.client_id
      ? await supabase.from('clients').select('name').eq('id', mergedRow.client_id).maybeSingle()
      : { data: null as null | { name?: string | null } }

    const clientName = clientNameFromMerged || String(client?.name ?? '').trim() || 'Client'

    const mergedPdf = await PDFDocument.create()
    let finalSignaturePdfBytes: Uint8Array | null = null

    for (const { reportId, report } of drafts) {
      const doors = Array.isArray(report.doors) ? (report.doors as MaintenanceFormValues['doors']) : []
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
        total_doors: Number(report.total_doors ?? (doors.length || 1)),
        notes: String(report.notes ?? ''),
        signature_data_url: '',
        signature_storage_url: String(report.signature_storage_url ?? ''),
        doors,
      }

      const pdfOptions = await buildMaintenancePdfOptions({ form, reportId, supabase })
      const pdfBytes = await generateMaintenanceReportPdf(pdfOptions)

      const src = await PDFDocument.load(pdfBytes)
      const srcPages = src.getPages()
      if (srcPages.length === 0) continue

      if (!finalSignaturePdfBytes) {
        finalSignaturePdfBytes = pdfBytes
      }

      const pagesToCopy = srcPages.slice(0, -1)
      if (pagesToCopy.length === 0) continue

      const copied = await mergedPdf.copyPages(src, pagesToCopy.map((_, idx) => idx))
      for (const p of copied) mergedPdf.addPage(p)
    }

    if (!finalSignaturePdfBytes) {
      return NextResponse.json({ error: 'No mergeable reports found' }, { status: 400 })
    }

    const signatureSrc = await PDFDocument.load(finalSignaturePdfBytes)
    const signaturePages = signatureSrc.getPages()
    if (signaturePages.length > 0) {
      const [sigPage] = await mergedPdf.copyPages(signatureSrc, [signaturePages.length - 1])
      mergedPdf.addPage(sigPage)
    }

    const pdfBytes = await mergedPdf.save()
    const date = new Date(String(mergedRow.created_at ?? '') || Date.now()).toISOString().slice(0, 10)
    const filename = `Merged_Report_${sanitizeFilenamePart(clientName)}_${date}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBytes.length),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate merged PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

