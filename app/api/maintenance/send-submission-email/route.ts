import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sendMailViaGraph } from '@/lib/graph/sendMail'

export const runtime = 'nodejs'

const NOTIFICATION_EMAIL = 'service@nbeaustralia.com.au'

function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role configuration.')
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { report_id?: string; reportId?: string }
    const reportId = body.report_id ?? body.reportId

    if (!reportId || typeof reportId !== 'string') {
      return NextResponse.json({ error: 'report_id or reportId is required.' }, { status: 400 })
    }

    const supabase = createSupabaseClient()

    const { data: report, error: reportError } = await supabase
      .from('maintenance_reports')
      .select('id, technician_name, inspection_date, inspection_start, inspection_end, total_doors, address, client_location_id, status')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { error: reportError?.message ?? 'Report not found.' },
        { status: 404 },
      )
    }

    let clientName = ''
    let locationName = ''

    if (report.client_location_id) {
      const { data: locationData } = await supabase
        .from('client_locations')
        .select('client_id, location_name, name, suburb, site_name')
        .eq('id', report.client_location_id)
        .single()

      if (locationData) {
        const loc = locationData as Record<string, unknown>
        locationName = String(
          loc.location_name ?? loc.name ?? loc.suburb ?? loc.site_name ?? '',
        ).trim()

        if (loc.client_id) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('client_name, name, company_name')
            .eq('id', loc.client_id)
            .single()

          if (clientData) {
            const c = clientData as Record<string, unknown>
            clientName = String(c.client_name ?? c.name ?? c.company_name ?? '').trim()
          }
        }
      }
    }

    const { count, error: doorsError } = await supabase
      .from('maintenance_doors')
      .select('*', { count: 'exact', head: true })
      .eq('report_id', reportId)

    if (doorsError) {
      return NextResponse.json(
        { error: `Failed to count doors: ${doorsError.message}` },
        { status: 500 },
      )
    }

    const totalDoors = Number(report.total_doors) || (count ?? 0) || 0
    const technicianName = String(report.technician_name ?? 'Unknown').trim()
    const inspectionDate = String(report.inspection_date ?? '').trim()
    const displayClient = clientName || 'Unknown Client'
    const displayLocation = locationName || 'Unknown Location'

    const subject = `Maintenance Report Submitted – ${displayClient} ${displayLocation}`

    const bodyText = [
      'Hi Team,',
      '',
      `I have completed the maintenance report at ${displayClient} ${displayLocation}.`,
      '',
      `Technician: ${technicianName}`,
      `Inspection Date: ${inspectionDate}`,
      `Doors Inspected: ${totalDoors}`,
      '',
      'You can review the report in the NBE Portal.',
      '',
      'Regards',
      'NBE Portal',
    ].join('\n')

    await sendMailViaGraph({
      to: NOTIFICATION_EMAIL,
      subject,
      bodyText,
    })

    return NextResponse.json({
      success: true,
      report_id: reportId,
      to: NOTIFICATION_EMAIL,
      subject,
      summary: {
        client_name: displayClient,
        location_name: displayLocation,
        technician_name: technicianName,
        inspection_date: inspectionDate,
        total_doors: totalDoors,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send submission email.'
    console.error('[send-submission-email]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
