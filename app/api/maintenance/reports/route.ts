import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { maintenanceReportClientViewUrl } from '@/lib/app/publicAppBaseUrl'

export const runtime = 'nodejs'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET() {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    const { data: reports, error } = await supabase
      .from('maintenance_reports')
      .select(
        'id, technician_name, inspection_date, status, created_at, client_location_id, pdf_url, approved, share_token',
      )
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const reportIdsMissingLocation = (reports ?? [])
      .filter(r => !r.client_location_id)
      .map(r => r.id)

    const inferredLocationByReportId = new Map<string, string>()
    if (reportIdsMissingLocation.length > 0) {
      const { data: linkedDoors } = await supabase
        .from('maintenance_doors')
        .select('report_id, door_id, created_at')
        .in('report_id', reportIdsMissingLocation)
        .order('created_at', { ascending: true })

      const firstDoorByReport = new Map<string, string>()
      ;(linkedDoors ?? []).forEach(row => {
        const reportId = String(row.report_id ?? '').trim()
        const doorId = String(row.door_id ?? '').trim()
        if (reportId && doorId && !firstDoorByReport.has(reportId)) {
          firstDoorByReport.set(reportId, doorId)
        }
      })

      const linkedDoorIds = [...new Set(Array.from(firstDoorByReport.values()))]
      if (linkedDoorIds.length > 0) {
        const { data: doors } = await supabase
          .from('doors')
          .select('id, client_location_id')
          .in('id', linkedDoorIds)

        const locationByDoorId = new Map(
          (doors ?? []).map(d => [String(d.id ?? ''), String(d.client_location_id ?? '').trim()])
        )

        firstDoorByReport.forEach((doorId, reportId) => {
          const locationId = locationByDoorId.get(doorId) ?? ''
          if (locationId) {
            inferredLocationByReportId.set(reportId, locationId)
          }
        })
      }
    }

    const locationIds = [...new Set(
      (reports ?? [])
        .map(r => String(r.client_location_id ?? '').trim() || inferredLocationByReportId.get(r.id) || '')
        .filter(Boolean)
    )] as string[]
    const { data: locations } = locationIds.length
      ? await supabase
          .from('client_locations')
          .select('*')
          .in('id', locationIds)
      : { data: [] as Array<{ id: string; location_name?: string; name?: string; suburb?: string; site_name?: string; client_id?: string }> }

    const clientIds = [...new Set((locations ?? []).map(l => l.client_id).filter(Boolean))] as string[]
    const { data: clients } = clientIds.length
      ? await supabase
          .from('clients')
          .select('*')
          .in('id', clientIds)
      : { data: [] as Array<{ id: string; client_name?: string; name?: string; company_name?: string }> }

    const locMap = new Map((locations ?? []).map(l => [l.id, l]))
    const clientMap = new Map((clients ?? []).map(c => [c.id, c]))

    const total = (reports ?? []).length
    const list = (reports ?? []).map((r, index) => {
      const resolvedLocationId = String(r.client_location_id ?? '').trim() || inferredLocationByReportId.get(r.id) || ''
      const loc = resolvedLocationId ? locMap.get(resolvedLocationId) : null
      const client = loc?.client_id ? clientMap.get(loc.client_id) : null
      const locationName = loc
        ? String(loc.location_name ?? loc.name ?? loc.site_name ?? loc.suburb ?? '').trim() || '—'
        : '—'
      const clientName = client
        ? String(client.client_name ?? client.name ?? client.company_name ?? '').trim() || '—'
        : '—'
      const sequence = total - index
      const report_number = `REP-${String(sequence).padStart(4, '0')}`
      const statusStr = String(r.status ?? '').trim()
      const approved = Boolean((r as { approved?: boolean | null }).approved)
      const shareToken = String((r as { share_token?: string | null }).share_token ?? '').trim()
      const client_view_url =
        statusStr === 'approved' && approved && shareToken
          ? maintenanceReportClientViewUrl(shareToken)
          : null

      return {
        id: r.id,
        report_number,
        client_name: clientName,
        location_name: locationName,
        technician_name: r.technician_name ?? '—',
        inspection_date: r.inspection_date ?? '—',
        status: r.status ?? 'draft',
        pdf_url: r.pdf_url ?? null,
        client_view_url,
      }
    })

    return NextResponse.json({ reports: list })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch maintenance reports'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
