import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { locationLabelFromDbRow } from '@/lib/supabase/clientLocationsDb'
import { requireMaintenanceStaffApi } from '@/lib/maintenance/requireMaintenanceStaffApi'
import { createLocationSchema } from '@/lib/validation/admin-clients'

function mapLocationRow(row: Record<string, unknown>) {
  const name = locationLabelFromDbRow(row as Parameters<typeof locationLabelFromDbRow>[0])
  const companyAddress = String(row.Company_address ?? row.company_address ?? '').trim()
  const normalizedCompanyAddress = companyAddress.toLowerCase() === 'null' ? '' : companyAddress
  const fallbackAddress = String(row.address ?? row.site_address ?? row.location_address ?? '')
  const suburbRaw = String(row.suburb ?? '').trim()
  return {
    id: String(row.id ?? ''),
    client_id: String(row.client_id ?? ''),
    name,
    address: String(normalizedCompanyAddress || fallbackAddress),
    suburb: suburbRaw || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMaintenanceStaffApi()
    if (!auth.ok) return auth.response

    const clientId = request.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ locations: [] })
    }

    const { data, error } = await auth.supabase
      .from('client_locations')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      throw error
    }

    const locations = (data ?? [])
      .map(row => mapLocationRow(row as Record<string, unknown>))
      .filter(item => item.id)
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ locations })
  } catch {
    return NextResponse.json({ locations: [] })
  }
}

export async function POST(request: Request) {
  const auth = await requireMaintenanceStaffApi()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = createLocationSchema.parse(body)

    const { data: clientRow } = await auth.supabase
      .from('clients')
      .select('id')
      .eq('id', parsed.client_id)
      .maybeSingle()

    if (!clientRow?.id) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }

    const insertRow = {
      client_id: parsed.client_id,
      location_name: parsed.location_name.trim(),
      Company_address: parsed.Company_address,
      suburb: parsed.suburb,
    }

    const { data, error } = await auth.supabase
      .from('client_locations')
      .insert(insertRow)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const location = mapLocationRow(data as Record<string, unknown>)
    return NextResponse.json({ location }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 422 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create location' },
      { status: 500 },
    )
  }
}
