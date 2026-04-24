import { PDFDocument } from 'pdf-lib'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import {
  aggregateSignOffDisplayMetrics,
  buildSignOffFindingGroups,
  combineMaintenanceFormsForBundle,
} from '@/lib/maintenance/reportMetrics'
import { buildMaintenancePdfOptions } from './buildMaintenancePdfOptions'
import { generateMaintenanceReportPdf, MAINTENANCE_PDF_PREFIX_PAGES } from './generateMaintenanceReportPdf'
import { loadNbeLogoBytes } from './loadNbeLogo'
import { generateMergedReportSignaturePdf } from './mergedReportSignaturePagePdf'
import { assertValidPdfSignature, savePdfBytes } from './savePdf'

function formFromDraft(report: Record<string, unknown>): MaintenanceFormValues {
  const doors = Array.isArray(report.doors) ? (report.doors as MaintenanceFormValues['doors']) : []
  const rawSchema = report.report_schema_version
  let report_schema_version: number | undefined
  if (rawSchema !== undefined && rawSchema !== null && rawSchema !== '') {
    const n = Number(rawSchema)
    if (Number.isFinite(n)) {
      report_schema_version = Math.trunc(n)
    }
  }
  return {
    report_id: report.report_id as string | undefined,
    report_schema_version,
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
}

/**
 * Concatenate per-report PDFs only (no summary cover): each report’s full content, with the first
 * segment including the standard intro page; later segments skip the duplicate intro. Ends with one
 * closing sign-off page for the bundle.
 */
export async function mergeMaintenanceReportPdfs(params: {
  supabase: SupabaseClient
  drafts: Array<{ reportId: string; report: Record<string, unknown> }>
  /** YYYY-MM-DD on the final merged sign-off page; defaults to UTC “today” if omitted */
  signatureDateLabel?: string
  /** QR on first segment cover only (PNG bytes). */
  coverQrPngBytes?: Uint8Array | null
  /** Manager-entered consolidated total doors for the merged bundle (shown once on the cover). */
  mergedTotalDoorsInspected?: number | null
}): Promise<Uint8Array> {
  const { supabase, drafts, signatureDateLabel, coverQrPngBytes, mergedTotalDoorsInspected } = params
  if (drafts.length === 0) {
    throw new Error('No mergeable reports found')
  }

  const logoBytes = await loadNbeLogoBytes()

  const pdfOptionsList = await Promise.all(
    drafts.map(async (d) => {
      const form = formFromDraft(d.report)
      return buildMaintenancePdfOptions({ form, reportId: d.reportId, supabase })
    }),
  )

  const mergedPdf = await PDFDocument.create()

  const lastOpts = pdfOptionsList[pdfOptionsList.length - 1]!
  const signOffDate =
    signatureDateLabel?.trim() || new Date().toISOString().slice(0, 10)

  for (let i = 0; i < drafts.length; i++) {
    const baseOptions = pdfOptionsList[i]!
    const pdfBytes = await generateMaintenanceReportPdf({
      ...baseOptions,
      ...(i === 0 && mergedTotalDoorsInspected != null && Number.isFinite(mergedTotalDoorsInspected)
        ? { mergedTotalDoorsCustomerInfo: { omitLine: false, displayValue: mergedTotalDoorsInspected } }
        : {}),
      ...(i === 0 && coverQrPngBytes && coverQrPngBytes.length > 0
        ? { coverQrPngBytes }
        : {}),
    })

    const src = await PDFDocument.load(pdfBytes)
    const srcPages = src.getPages()
    if (srcPages.length === 0) continue

    const sigIndex = srcPages.length - 1

    /**
     * First merged segment: copy all pages except the per-report signature (indices 0 .. sigIndex-1).
     * Later segments: skip the first-page intro only (MAINTENANCE_PDF_PREFIX_PAGES) —
     * copy door pages through sigIndex-1 only.
     */
    let pageIndices: number[]
    if (i === 0) {
      pageIndices = Array.from({ length: sigIndex }, (_, j) => j)
    } else {
      if (sigIndex <= MAINTENANCE_PDF_PREFIX_PAGES) continue
      pageIndices = Array.from({ length: sigIndex - MAINTENANCE_PDF_PREFIX_PAGES }, (_, j) => j + MAINTENANCE_PDF_PREFIX_PAGES)
    }

    if (pageIndices.length === 0) continue

    const copied = await mergedPdf.copyPages(src, pageIndices)
    for (const page of copied) mergedPdf.addPage(page)
  }

  const forms = drafts.map(d => formFromDraft(d.report))
  const combinedForm = combineMaintenanceFormsForBundle(forms)
  const signMetrics = aggregateSignOffDisplayMetrics(combinedForm)
  const signFindingGroups = buildSignOffFindingGroups(combinedForm)

  const signatureBytes = await generateMergedReportSignaturePdf({
    logoBytes,
    technicianName: lastOpts.form.technician_name || '-',
    technicianSignatureBytes: lastOpts.signatureBytes ?? null,
    reportDateLabel: signOffDate,
    signOff: {
      metrics: signMetrics,
      findingGroups: signFindingGroups,
    },
  })

  const sigDoc = await PDFDocument.load(signatureBytes)
  const sigPages = sigDoc.getPages()
  if (sigPages.length > 0) {
    const [p] = await mergedPdf.copyPages(sigDoc, [0])
    mergedPdf.addPage(p)
  }

  const out = await savePdfBytes(mergedPdf)
  assertValidPdfSignature(out, 'mergeMaintenanceReportPdfs')
  return out
}
