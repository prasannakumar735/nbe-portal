import { randomUUID } from 'crypto'
import QRCode from 'qrcode'
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

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden. Managers only.' }, { status: 403 })
    }

    const requestBody = (await request.json().catch(() => null)) as null | {
      reportIds?: unknown
      totalDoorsInspected?: unknown
    }
    const reportIds = Array.isArray(requestBody?.reportIds)
      ? requestBody!.reportIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : []

    const rawDoors = requestBody?.totalDoorsInspected
    const parsedDoors =
      typeof rawDoors === 'number'
        ? rawDoors
        : typeof rawDoors === 'string' && rawDoors.trim() !== ''
          ? Number(rawDoors)
          : NaN
    if (!Number.isFinite(parsedDoors) || parsedDoors <= 0 || !Number.isInteger(parsedDoors)) {
      return NextResponse.json(
        { error: 'Total Doors Inspected is required and must be a whole number greater than 0' },
        { status: 400 },
      )
    }
    const totalDoorsInspected = parsedDoors

    const uniqueReportIds = Array.from(new Set(reportIds))
    if (uniqueReportIds.length < 2) {
      return NextResponse.json({ error: 'Select at least 2 reports to merge' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const drafts = (
      await Promise.all(
        uniqueReportIds.map(async reportId => {
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
    if (uniqueClientIds.length !== 1) {
      return NextResponse.json({ error: 'Only reports from same client can be merged' }, { status: 400 })
    }

    const clientName = String(drafts[0].report.client_name ?? '').trim() || 'Client'
    const clientId = String(drafts[0].report.client_id ?? '').trim()

    const preparedOn = new Date().toISOString().slice(0, 10)

    const accessToken = randomUUID()
    const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).replace(/\/$/, '')
    const viewerUrl = `${appBase}/report/view/${accessToken}`

    let coverQrPngBytes: Uint8Array | null = null
    try {
      const buf = await QRCode.toBuffer(viewerUrl, {
        type: 'png',
        width: 240,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
      coverQrPngBytes = new Uint8Array(buf)
    } catch {
      coverQrPngBytes = null
    }

    const accessExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const storagePath = `${accessToken}.pdf`

    let pdfBytes: Uint8Array
    try {
      pdfBytes = await mergeMaintenanceReportPdfs({
        supabase,
        drafts,
        signatureDateLabel: preparedOn,
        coverQrPngBytes,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to merge PDFs'
      if (msg === 'No mergeable reports found') {
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      throw e
    }
    assertValidPdfSignature(pdfBytes, 'POST merge-reports')
    const date = new Date().toISOString().slice(0, 10)
    const filename = `Merged_Report_${sanitizeFilenamePart(clientName)}_${date}.pdf`

    if (clientId) {
      let storageOk = false
      try {
        const uploadBytes = new Uint8Array(pdfBytes.byteLength)
        uploadBytes.set(pdfBytes)
        const { error: upErr } = await supabase.storage
          .from(MERGED_MAINTENANCE_REPORTS_BUCKET)
          .upload(storagePath, uploadBytes, {
            contentType: 'application/pdf',
            upsert: true,
          })
        storageOk = !upErr
      } catch {
        storageOk = false
      }

      try {
        await supabase.from('merged_reports').insert({
          client_id: clientId,
          client_name: clientName,
          report_ids: uniqueReportIds,
          created_by: user.id,
          file_url: null,
          total_doors_inspected: totalDoorsInspected,
          access_token: accessToken,
          share_token: accessToken,
          pdf_url: viewerUrl,
          pdf_storage_path: storageOk ? storagePath : null,
          access_expires_at: accessExpiresAt,
        })
      } catch {
        try {
          await supabase.from('merged_reports').insert({
            client_id: clientId,
            client_name: clientName,
            report_ids: uniqueReportIds,
            created_by: user.id,
            file_url: null,
            total_doors_inspected: totalDoorsInspected,
            access_token: accessToken,
            pdf_url: viewerUrl,
            pdf_storage_path: storageOk ? storagePath : null,
            access_expires_at: accessExpiresAt,
          })
        } catch {
          try {
            await supabase.from('merged_reports').insert({
              client_id: clientId,
              client_name: clientName,
              report_ids: uniqueReportIds,
              created_by: user.id,
              file_url: null,
              total_doors_inspected: totalDoorsInspected,
            })
          } catch {
            // non-blocking
          }
        }
      }
    }

    return createPdfBinaryResponse(pdfBytes, {
      contentDisposition: `attachment; filename="${filename}"`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to merge reports'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

