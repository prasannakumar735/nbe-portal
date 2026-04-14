import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildMaintenanceReportEmailTemplate } from '@/lib/email/maintenanceReportEmailTemplate'

export const runtime = 'nodejs'

function createWriteClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function deriveSiteName(locationName?: string, clientName?: string): string {
  if (locationName?.trim()) {
    return locationName
  }

  if (clientName?.trim()) {
    return clientName
  }

  return 'Unknown Site'
}

export async function POST(request: NextRequest) {
  try {
    const { reportId } = (await request.json()) as { reportId?: string }

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
    }

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured.' }, { status: 500 })
    }

    const supabase = createWriteClient()

    const { data: report, error: reportError } = await supabase
      .from('maintenance_reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      throw new Error(reportError?.message || 'Maintenance report not found.')
    }

    const { data: doors, error: doorsError } = await supabase
      .from('maintenance_doors')
      .select('id')
      .eq('report_id', reportId)

    if (doorsError) {
      throw new Error(doorsError.message)
    }

    let clientName = ''
    let locationName = ''

    if (report.client_location_id) {
      const { data: locationData } = await supabase
        .from('client_locations')
        .select('client_id, location_name, name, suburb')
        .eq('id', report.client_location_id)
        .single()

      if (locationData) {
        locationName = String(locationData.location_name ?? locationData.name ?? locationData.suburb ?? '').trim()

        if (locationData.client_id) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('client_name, name')
            .eq('id', locationData.client_id)
            .single()

          if (clientData) {
            clientName = String(clientData.client_name ?? clientData.name ?? '').trim()
          }
        }
      }
    }

    const pdfUrl = String(report.pdf_url ?? '').trim()
    if (!pdfUrl) {
      return NextResponse.json({ error: 'Report PDF URL is missing.' }, { status: 400 })
    }

    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      throw new Error(`Unable to download report PDF (${pdfResponse.status})`)
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer()
    const pdfBuffer = Buffer.from(pdfArrayBuffer)

    const fromEmail = 'noreply@nbeaustralia.com.au'

    const siteName = deriveSiteName(locationName, clientName)

    const resend = new Resend(resendKey)

    const emailTemplate = buildMaintenanceReportEmailTemplate({
      technicianName: String(report.technician_name ?? 'Unknown Technician'),
      siteName,
      address: String(report.address ?? '-'),
      inspectionDate: String(report.inspection_date ?? '-'),
      inspectionStart: String(report.inspection_start ?? '-'),
      inspectionEnd: String(report.inspection_end ?? '-'),
      totalDoors: Number(report.total_doors ?? doors?.length ?? 0),
    })

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: ['service@nbeaustralia.com.au'],
      subject: `Maintenance Inspection Report - ${siteName}`,
      html: emailTemplate,
      attachments: [
        {
          filename: `Maintenance_Report_${reportId}.pdf`,
          content: pdfBuffer.toString('base64'),
        },
      ],
    })

    return NextResponse.json({
      success: true,
      report_id: reportId,
      email_id: emailResponse.data?.id,
      summary: {
        technician_name: report.technician_name,
        site_name: siteName,
        total_doors: Number(report.total_doors ?? doors?.length ?? 0),
      },
    })
  } catch (error) {
    console.error('Send Maintenance Report Email Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to send maintenance report email.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
