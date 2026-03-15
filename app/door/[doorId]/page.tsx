import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

const EMERGENCY_CONTACT_NUMBER = '(03) 9357 5858'
type DoorPageProps = {
  params: Promise<{ doorId: string }>
}

type DoorRow = {
  id: string
  door_label?: string | null
  door_type?: string | null
  install_date?: string | null
  client_location_id?: string | null
  manufactured_by?: string | null
}

type LocationRow = {
  id: string
  client_id?: string | null
  location_name?: string | null
  name?: string | null
  suburb?: string | null
  site_name?: string | null
  address?: string | null
}

type ClientRow = {
  id: string
  client_name?: string | null
  name?: string | null
  company_name?: string | null
}

type InspectionRow = {
  created_at?: string | null
  report_id?: string | null
}

function formatDate(value?: string | null, fallback = 'Not available'): string {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function DoorInfoPage({ params }: DoorPageProps) {
  const { doorId } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: doorData, error: doorError } = await supabase
    .from('doors')
    .select('*')
    .eq('id', doorId)
    .maybeSingle()

  if (doorError || !doorData) {
    notFound()
  }

  const door = doorData as DoorRow

  let locationLabel = 'Not available'
  let clientLabel = 'Not available'

  const clientLocationId = String(door.client_location_id ?? '').trim()
  if (clientLocationId) {
    const { data: locationData } = await supabase
      .from('client_locations')
      .select('*')
      .eq('id', clientLocationId)
      .maybeSingle()

    const location = locationData as LocationRow | null
    if (location) {
      locationLabel = String(
        location.location_name ?? location.name ?? location.suburb ?? location.site_name ?? location.address ?? ''
      ).trim() || 'Not available'

      const clientId = String(location.client_id ?? '').trim()
      if (clientId) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .maybeSingle()

        const client = clientData as ClientRow | null
        if (client) {
          clientLabel = String(client.client_name ?? client.name ?? client.company_name ?? '').trim() || 'Not available'
        }
      }
    }
  }

  const { data: latestInspectionData } = await supabase
    .from('door_inspections')
    .select('created_at, report_id')
    .eq('door_id', doorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestInspection = latestInspectionData as InspectionRow | null
  let servicedBy = 'NBE Australia'
  if (latestInspection?.report_id) {
    const { data: reportData } = await supabase
      .from('maintenance_reports')
      .select('technician_name')
      .eq('id', latestInspection.report_id)
      .maybeSingle()

    const technicianName = String((reportData as { technician_name?: string | null } | null)?.technician_name ?? '').trim()
    if (technicianName) {
      servicedBy = technicianName
    }
  }

  const doorNumberLabel = String(door.door_label ?? '').trim() || door.id
  const doorTypeLabel = String(door.door_type ?? '').trim() || 'Not available'
  const manufacturerLabel = String(door.manufactured_by ?? '').trim() || 'NBE Australia'
  const installDateLabel = formatDate(door.install_date)
  const lastServicedLabel = formatDate(latestInspection?.created_at, 'Not yet serviced')

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <header className="text-center">
          <div className="mb-8 flex flex-col items-center">
            <Image
              src="/nbe-logo.png"
              alt="NBE Australia"
              width={220}
              height={72}
              className="object-contain"
              priority
            />
            <p className="mt-2 text-xs tracking-wider text-slate-500 md:text-sm">INDUSTRIAL DOOR INFORMATION</p>
          </div>
        </header>

        <main className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-5">
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Door Details</h2>
              <div className="grid grid-cols-1 gap-2 text-sm text-slate-800">
                <div className="flex justify-between gap-4"><span className="font-semibold text-slate-600">Door Number</span><span>{doorNumberLabel}</span></div>
                <div className="flex justify-between gap-4"><span className="font-semibold text-slate-600">Door Type</span><span>{doorTypeLabel}</span></div>
                <div className="flex justify-between gap-4"><span className="font-semibold text-slate-600">Location</span><span>{locationLabel}</span></div>
                <div className="flex justify-between gap-4"><span className="font-semibold text-slate-600">Client Name</span><span>{clientLabel}</span></div>
                <div className="flex justify-between gap-4"><span className="font-semibold text-slate-600">Manufactured By</span><span>{manufacturerLabel}</span></div>
                <div className="flex justify-between gap-4"><span className="font-semibold text-slate-600">Installed Date</span><span>{installDateLabel}</span></div>
                <div className="flex justify-between gap-4"><span className="font-semibold text-slate-600">Last Serviced</span><span>{lastServicedLabel}</span></div>
                <div className="flex justify-between gap-4"><span className="font-semibold text-slate-600">Serviced By</span><span>{servicedBy}</span></div>
                <div className="flex justify-between gap-4"><span className="font-semibold text-slate-600">Emergency Contact</span><span>{EMERGENCY_CONTACT_NUMBER}</span></div>
              </div>
            </section>

            {user && (
              <section className="pt-2">
                <Link
                  href={`/maintenance/new?doorId=${encodeURIComponent(doorId)}`}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Start Maintenance Inspection
                </Link>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

