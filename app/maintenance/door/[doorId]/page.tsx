import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

type DoorPageProps = {
  params: Promise<{
    doorId: string
  }>
}

type DoorRow = {
  id: string
  door_label?: string | null
  door_type?: string | null
  client_location_id?: string | null
}

type LocationRow = {
  id: string
  client_id?: string | null
  location_name?: string | null
  name?: string | null
  suburb?: string | null
  site_name?: string | null
}

type ClientRow = {
  id: string
  client_name?: string | null
  name?: string | null
  company_name?: string | null
}

export default async function MaintenanceDoorPage({ params }: DoorPageProps) {
  const { doorId } = await params
  const supabase = await createServerClient()

  const { data: doorData, error: doorError } = await supabase
    .from('doors')
    .select('id, door_label, door_type, client_location_id')
    .eq('id', doorId)
    .maybeSingle()

  if (doorError || !doorData) {
    notFound()
  }

  const door = doorData as DoorRow

  let locationName = '—'
  let clientName = '—'

  const clientLocationId = String(door.client_location_id ?? '').trim()
  if (clientLocationId) {
    const { data: locationData } = await supabase
      .from('client_locations')
      .select('*')
      .eq('id', clientLocationId)
      .maybeSingle()

    const location = locationData as LocationRow | null
    if (location) {
      locationName = String(
        location.location_name ?? location.name ?? location.suburb ?? location.site_name ?? ''
      ).trim() || '—'

      const clientId = String(location.client_id ?? '').trim()
      if (clientId) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .maybeSingle()

        const client = clientData as ClientRow | null
        if (client) {
          clientName = String(client.client_name ?? client.name ?? client.company_name ?? '').trim() || '—'
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Door Maintenance Access</h1>
        <p className="mt-1 text-sm text-slate-600">QR-linked door details for maintenance inspection.</p>

        <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Door ID</p>
            <p className="text-sm text-slate-900">{door.id}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Door Location</p>
            <p className="text-sm text-slate-900">{locationName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client Name</p>
            <p className="text-sm text-slate-900">{clientName}</p>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href={`/maintenance/new?doorId=${encodeURIComponent(door.id)}`}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Start Maintenance Inspection
          </Link>
        </div>
      </div>
    </div>
  )
}
