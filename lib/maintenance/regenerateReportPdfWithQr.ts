import type { SupabaseClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { maintenanceReportClientViewUrl } from '@/lib/app/publicAppBaseUrl'
import { generateMaintenanceReportPdf } from '@/lib/pdf/generateMaintenanceReportPdf'
import { buildMaintenancePdfOptions } from '@/lib/pdf/buildMaintenancePdfOptions'
import { loadMaintenanceReportDraftPayload } from '@/lib/maintenance/loadMaintenanceReportDraftPayload'
import { draftPayloadToFormValues } from '@/lib/maintenance/draftPayloadToFormValues'

/**
 * After approval: embed client-view QR on cover and re-upload PDF to maintenance-images.
 */
export async function regenerateMaintenanceReportPdfWithClientQr(params: {
  supabase: SupabaseClient
  reportId: string
  shareToken: string
}): Promise<{ pdf_url: string } | { error: string }> {
  const { supabase, reportId, shareToken } = params

  const viewerUrl = maintenanceReportClientViewUrl(shareToken) ?? ''
  if (!viewerUrl) {
    return { error: 'Invalid share token for PDF QR' }
  }
  let qrPng: Buffer
  try {
    qrPng = await QRCode.toBuffer(viewerUrl, {
      type: 'png',
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'QR generation failed' }
  }

  const raw = await loadMaintenanceReportDraftPayload(supabase, reportId)
  if (!raw) {
    return { error: 'Could not load report payload for PDF' }
  }

  const form = draftPayloadToFormValues(raw as Record<string, unknown>)
  const pdfOptions = await buildMaintenancePdfOptions({ form, reportId, supabase })
  pdfOptions.coverQrPngBytes = new Uint8Array(qrPng)

  const pdfBytes = await generateMaintenanceReportPdf(pdfOptions)
  const fileName = `maintenance-report-${pdfOptions.reportNumber}.pdf`
  const storagePath = `reports/${reportId}/${fileName}`

  const upload = await supabase.storage.from('maintenance-images').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  })

  if (upload.error) {
    return { error: upload.error.message }
  }

  const { data: publicUrlData } = supabase.storage.from('maintenance-images').getPublicUrl(storagePath)
  const publicUrl = publicUrlData.publicUrl

  const { error: updErr } = await supabase.from('maintenance_reports').update({ pdf_url: publicUrl }).eq('id', reportId)

  if (updErr) {
    return { error: updErr.message }
  }

  return { pdf_url: publicUrl }
}
