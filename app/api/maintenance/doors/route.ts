import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

function strOrNull(row: Record<string, unknown>, key: string): string | null {
  const v = row[key]
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

function mapDoorRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    client_location_id: String(row.client_location_id ?? ''),
    door_label: String(row.door_label ?? row.door_number ?? '').trim(),
    door_type: String(row.door_type ?? '').trim(),
    install_date: row.install_date ? String(row.install_date) : null,
    door_description: strOrNull(row, 'door_description'),
    door_type_alt: strOrNull(row, 'door_type_alt'),
    cw: strOrNull(row, 'cw'),
    ch: strOrNull(row, 'ch'),
  }
}

export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get('locationId')
    if (!locationId) {
      return NextResponse.json({ doors: [] })
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('doors')
      .select('*')
      .eq('client_location_id', locationId)
      .order('door_label', { ascending: true })
      .limit(300)

    if (error) {
      throw error
    }

    const doors = (data ?? [])
      .map(row => mapDoorRow(row as Record<string, unknown>))
      .filter(item => item.id)

    return NextResponse.json({ doors })
  } catch {
    return NextResponse.json({ doors: [] })
  }
}
