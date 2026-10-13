import { NextRequest, NextResponse } from 'next/server'
import { requireMaintenanceStaffApi } from '@/lib/maintenance/requireMaintenanceStaffApi'
import { compareDoorRecordsByLabel } from '@/lib/door/doorLabelSort'

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
    door_serial: strOrNull(row, 'door_serial'),
    door_type: String(row.door_type ?? '').trim(),
    install_date: row.install_date ? String(row.install_date) : null,
    door_description: strOrNull(row, 'door_description'),
    door_type_alt: strOrNull(row, 'door_type_alt'),
    cw: strOrNull(row, 'cw'),
    ch: strOrNull(row, 'ch'),
    motor_side: (row.motor_side === 'RHD' || row.motor_side === 'LHD') ? row.motor_side : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMaintenanceStaffApi()
    if (!auth.ok) return auth.response

    const locationId = request.nextUrl.searchParams.get('locationId')
    if (!locationId) {
      return NextResponse.json({ doors: [] })
    }

    const { data, error } = await auth.supabase
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
      .sort(compareDoorRecordsByLabel)

    return NextResponse.json({ doors })
  } catch {
    return NextResponse.json({ doors: [] })
  }
}
