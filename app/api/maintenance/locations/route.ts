import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

function mapLocationRow(row: Record<string, unknown>) {
  const name = String(row.location_name ?? row.name ?? row.suburb ?? row.site_name ?? '').trim()
  return {
    id: String(row.id ?? ''),
    client_id: String(row.client_id ?? ''),
    name: name || 'Unknown Location',
    address: String(row.address ?? row.site_address ?? row.location_address ?? ''),
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
