import { NextResponse } from 'next/server'
import { requireMaintenanceStaffApi } from '@/lib/maintenance/requireMaintenanceStaffApi'

function mapCustomerRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? row.customer_id ?? ''),
    name: String(row.name ?? row.customer_name ?? row.company_name ?? row.location_name ?? 'Unknown'),
    address: String(row.address ?? row.site_address ?? row.location_address ?? ''),
  }
}

export async function GET() {
  try {
    const auth = await requireMaintenanceStaffApi()
    if (!auth.ok) return auth.response

    const { data, error } = await auth.supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      throw error
    }

    const customers = (data ?? []).map(row => mapCustomerRow(row as Record<string, unknown>)).filter(item => item.id)
    return NextResponse.json({ customers })
  } catch {
    return NextResponse.json({ customers: [] })
  }
}
