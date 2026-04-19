import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { maintenanceFormSchema } from '@/lib/validation/maintenance'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import { generateMaintenanceReportPdf } from '@/lib/pdf/generateMaintenanceReportPdf'
import { buildMaintenancePdfOptions } from '@/lib/pdf/buildMaintenancePdfOptions'
import { uploadFileToOneDrive } from '@/lib/graph/uploadFile'
import { notifyManagersOfReportSubmission } from '@/lib/maintenance/reportWorkflowEmail'

export const runtime = 'nodejs'

function getBodyForm(body: unknown): unknown {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return (body as Record<string, unknown>).form
  }
  return undefined
}

function createWriteClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration for maintenance submit.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(request: NextRequest) {
  let body: unknown = null
  try {
    body = await request.json()

    const serverSupabase = await createServerClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()

    console.log('[Maintenance Submit API] Incoming payload:', {
      hasForm: typeof body === 'object' && body !== null ? Boolean((body as Record<string, unknown>).form) : false,
      keys: typeof body === 'object' && body !== null ? Object.keys(body as Record<string, unknown>) : [],
    })

    const form = maintenanceFormSchema.parse(getBodyForm(body))

    const saveResponse = await fetch(new URL('/api/maintenance/draft', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_id: form.report_id,
        status: 'submitted',
        form,
      }),
    })

    const saved = await saveResponse.json()
    if (!saveResponse.ok) {
      throw new Error(saved.error || 'Unable to submit report')
    }

    const reportId = saved.report_id as string
    const finalForm: MaintenanceFormValues = {
      ...form,
      report_id: reportId,
      address: String(form.address ?? '').trim(),
    }
    const supabase = createWriteClient()

    const submitterEmail = String(user?.email ?? '').trim()
    const submitterPhone = String(user?.phone ?? '').trim()
    const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
    const submitterContact = (
      submitterPhone ||
      String(metadata.contact ?? metadata.phone ?? metadata.mobile ?? metadata.mobile_number ?? '').trim()
    )

    const submitterUpdate: Record<string, string> = {}
    if (submitterEmail) {
      submitterUpdate.technician_email = submitterEmail
      submitterUpdate.submitter_email = submitterEmail
    }
    if (submitterContact) {
      submitterUpdate.technician_contact = submitterContact
      submitterUpdate.submitter_contact = submitterContact
    }

    if (Object.keys(submitterUpdate).length > 0) {
      const { error: submitterUpdateError } = await supabase
        .from('maintenance_reports')
        .update(submitterUpdate)
        .eq('id', reportId)

      if (submitterUpdateError) {
        console.warn('[Maintenance Submit API] Unable to persist submitter details on report', {
          reportId,
          message: submitterUpdateError.message,
        })
      }
    }

    let submissionEmailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
    let submissionEmailReason = ''
    try {
      // Call workflow email in-process (avoids unreliable self-fetch on some serverless hosts).
      const workflow = await notifyManagersOfReportSubmission(supabase, reportId)
      if (workflow.status === 'sent') {
        submissionEmailStatus = 'sent'
        submissionEmailReason =
          workflow.recipients > 0 ? `Sent to ${workflow.recipients} recipient(s).` : 'Sent.'
      } else if (workflow.status === 'skipped') {
        submissionEmailStatus = 'skipped'
        submissionEmailReason = workflow.reason
      } else {
        submissionEmailStatus = 'failed'
        submissionEmailReason = workflow.error
      }
    } catch (e) {
      submissionEmailStatus = 'failed'
      submissionEmailReason = e instanceof Error ? e.message : 'Request failed'
    }

    // OneDrive: upload inspection photos (best-effort; do not fail submission)
    try {
      const { data: locationRow } = await supabase
        .from('client_locations')
        .select('location_name, suburb, client_id')
        .eq('id', finalForm.client_location_id)
        .single()

      const loc = locationRow as Record<string, unknown> | null
      let clientLocationSegment = String(
        loc?.location_name ?? loc?.suburb ?? 'Unknown',
      ).trim()
      if (loc?.client_id) {
        const { data: clientRow } = await supabase
          .from('clients')
          .select('name, company_name')
          .eq('id', loc.client_id)
          .single()
        const c = clientRow as Record<string, unknown> | null
        const clientName = String(c?.name ?? c?.company_name ?? '').trim()
        if (clientName) clientLocationSegment = `${clientName} ${clientLocationSegment}`.trim()
      }
      clientLocationSegment = clientLocationSegment.replace(/[\\/:*?"<>|]/g, '_') || 'Unknown'

      const year = finalForm.inspection_date.slice(0, 4)
      const inspectionDate = finalForm.inspection_date
      const oneDriveFolder = `NBE-Maintenance-Reports/${year}/${clientLocationSegment}/${inspectionDate}`

      let photoIndex = 0
      for (let doorIdx = 0; doorIdx < finalForm.doors.length; doorIdx += 1) {
        const door = finalForm.doors[doorIdx]!
        const photos = door.photos ?? []
        for (let p = 0; p < photos.length; p += 1) {
          const photo = photos[p]!
          try {
            const res = await fetch(photo.url)
            if (!res.ok) {
              console.error('[Maintenance Submit] OneDrive: failed to download photo', {
                reportId,
                doorIdx,
                photoIndex,
                status: res.status,
              })
              photoIndex += 1
              continue
            }
            const arrayBuffer = await res.arrayBuffer()
            const fileBuffer = Buffer.from(arrayBuffer)
            const ext = (photo.path.split('.').pop() || photo.url.split('.').pop() || 'jpg')
              .split('?')[0]
              .toLowerCase()
            const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
            const fileName = `door-${doorIdx + 1}-${photoIndex + 1}.${safeExt}`
            const oneDrivePath = `${oneDriveFolder}/${fileName}`
            await uploadFileToOneDrive(fileBuffer, oneDrivePath)
          } catch (uploadErr) {
            console.error('[Maintenance Submit] OneDrive: upload failed for photo', {
              reportId,
              doorIdx,
              photoIndex,
              error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
            })
          }
          photoIndex += 1
        }
      }
    } catch (onedriveErr) {
      console.error('[Maintenance Submit] OneDrive photo upload failed (non-fatal)', {
        reportId,
        error: onedriveErr instanceof Error ? onedriveErr.message : String(onedriveErr),
      })
    }

    const pdfOptions = await buildMaintenancePdfOptions({
      form: finalForm,
      reportId,
      supabase,
    })
    const pdfBytes = await generateMaintenanceReportPdf(pdfOptions)
    const fileName = `maintenance-report-${pdfOptions.reportNumber}.pdf`

    const storagePath = `reports/${reportId}/${fileName}`
    const upload = await supabase.storage.from('maintenance-images').upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })

    if (upload.error) {
      throw upload.error
    }

    const { data: publicUrlData } = supabase.storage.from('maintenance-images').getPublicUrl(storagePath)

    const { error: updateError } = await supabase
      .from('maintenance_reports')
      .update({ pdf_url: publicUrlData.publicUrl })
      .eq('id', reportId)

    if (updateError) {
      throw updateError
    }

    let reportEmailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
    let reportEmailReason = ''
    try {
      const emailResponse = await fetch(new URL('/api/send-maintenance-report-email', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      if (emailResponse.ok) {
        reportEmailStatus = 'sent'
      } else {
        const errorPayload = await emailResponse.json()
        reportEmailReason = errorPayload.error || 'Email API request failed.'
        reportEmailStatus = 'failed'
      }
    } catch (error) {
      reportEmailStatus = 'failed'
      reportEmailReason = error instanceof Error ? error.message : 'Email failed'
    }

    return NextResponse.json({
      report_id: reportId,
      status: 'submitted',
      pdf_url: publicUrlData.publicUrl,
      submission_email: {
        status: submissionEmailStatus,
        reason: submissionEmailReason,
      },
      report_email: {
        status: reportEmailStatus,
        reason: reportEmailReason,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit maintenance report.'
    console.error('[Maintenance Submit API] Failed to submit report', {
      message,
      error,
      hasBody: Boolean(body),
    })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
