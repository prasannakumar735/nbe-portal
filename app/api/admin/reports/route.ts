import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'

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

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isAdmin(profile as { role?: string } | null)) {
      return NextResponse.json({ error: 'Forbidden. Admin only.' }, { status: 403 })
    }

    const supabase = createServiceClient()

    const { data: reports, error } = await supabase
      .from('maintenance_reports')
      .select('id, technician_name, inspection_date, status, submitted_at, client_location_id, address')
      .in('status', ['submitted', 'reviewing'])
      .order('submitted_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const locationIds = [...new Set((reports ?? []).map(r => r.client_location_id).filter(Boolean))] as string[]
    const { data: locations } = locationIds.length
      ? await supabase
          .from('client_locations')
          .select('id, location_name, name, suburb, site_name, client_id')
          .in('id', locationIds)
      : { data: [] as Array<{ id: string; location_name?: string; name?: string; suburb?: string; site_name?: string; client_id?: string }> }

    const clientIds = [...new Set((locations ?? []).map(l => l.client_id).filter(Boolean))] as string[]
    const { data: clients } = clientIds.length
      ? await supabase
          .from('clients')
          .select('id, client_name, name, company_name')
          .in('id', clientIds)
      : { data: [] as Array<{ id: string; client_name?: string; name?: string; company_name?: string }> }

    const locMap = new Map((locations ?? []).map(l => [l.id, l]))
    const clientMap = new Map((clients ?? []).map(c => [c.id, c]))

    const list = (reports ?? []).map(r => {
      const loc = r.client_location_id ? locMap.get(r.client_location_id) : null
      const client = loc?.client_id ? clientMap.get(loc.client_id) : null
      const locationName = loc
        ? String(loc.location_name ?? loc.name ?? loc.suburb ?? loc.site_name ?? '').trim()
        : ''
      const clientName = client
        ? String(client.client_name ?? client.name ?? client.company_name ?? '').trim()
        : ''
      return {
        id: r.id,
        technician_name: r.technician_name,
        inspection_date: r.inspection_date,
        status: r.status,
        submitted_at: r.submitted_at,
        address: r.address,
        location_name: locationName,
        client_name: clientName,
      }
    })

    return NextResponse.json({ reports: list })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch admin reports'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
