import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { locationLabelFromDbRow } from '@/lib/supabase/clientLocationsDb'

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
    const clientId = request.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return NextResponse.json({ locations: [] })
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase
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
