'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase/client'
import { supabasePublic } from '@/lib/supabasePublic'

type DoorLocation = {
  suburb?: string | null
  address?: string | null
}

type DoorPublicDetails = {
  door_label: string | null
  door_type: string | null
  install_date: string | null
  client_locations: DoorLocation | DoorLocation[] | null
}

type LatestInspection = {
  created_at: string | null
  technician_notes: string | null
}

const EMERGENCY_CONTACT_NUMBER = '(03) 9357 5858'

export default function DoorInfoPage() {
  const params = useParams<{ doorId: string }>()
  const doorId = params?.doorId

  const [door, setDoor] = useState<DoorPublicDetails | null>(null)
  const [inspection, setInspection] = useState<LatestInspection | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const supabase = useMemo(() => createSupabaseClient(), [])

  useEffect(() => {
    let isActive = true

    const fetchData = async () => {
      if (!doorId || typeof doorId !== 'string') {
        setError('Door not found.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // 1. Fetch door by ID (no join)
        const { data: doorData, error: doorError } = await supabasePublic
          .from('doors')
          .select('*')
          .eq('id', doorId)
          .maybeSingle()

        if (!isActive) return

        console.log('Door query result:', doorData)
        console.log('Door query error:', doorError)

        if (!doorData) {
          setError('Door not found.')
          setDoor(null)
          setInspection(null)
          return
        }

        // 2. Fetch client location for this door (safe, separate query)
        let location: DoorLocation | null = null
        if (doorData.client_location_id) {
          const { data: locationData } = await supabasePublic
            .from('client_locations')
            .select('suburb,address')
            .eq('id', doorData.client_location_id)
            .maybeSingle()

          if (!isActive) return

          if (locationData) {
            location = {
              suburb: (locationData as { suburb?: string | null }).suburb ?? null,
              address: (locationData as { address?: string | null }).address ?? null,
            }
          }
        }

        const doorDetails: DoorPublicDetails = {
          door_label: (doorData as { door_label?: string | null }).door_label ?? null,
          door_type: (doorData as { door_type?: string | null }).door_type ?? null,
          install_date: (doorData as { install_date?: string | null }).install_date ?? null,
          client_locations: location,
        }

        setDoor(doorDetails)

        // 3. Fetch latest inspection (only exposes date + technician notes)
        const { data: inspectionData } = await supabasePublic
          .from('door_inspections')
          .select('created_at, technician_notes')
          .eq('door_id', doorId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!isActive) return

        if (inspectionData) {
          setInspection(inspectionData as LatestInspection)
        } else {
          setInspection(null)
        }
      } catch (err) {
        if (!isActive) return
        console.error('[DoorInfoPage] Unexpected error loading door info:', { doorId, err })
        setError('Unable to load door information at this time.')
        setDoor(null)
        setInspection(null)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void fetchData()

    return () => {
      isActive = false
    }
  }, [doorId])

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        setSession(data.session)
        setIsLoggedIn(!!data.session)
      } catch {
        setSession(null)
        setIsLoggedIn(false)
      }
    }

    checkSession()
  }, [supabase])

  const resolvedLocation = (() => {
    if (!door?.client_locations) return null
    if (Array.isArray(door.client_locations)) {
      return door.client_locations[0] ?? null
    }
    return door.client_locations
  })()

  const installDateLabel = door?.install_date
    ? new Date(door.install_date).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Not available'

  const lastServiceDateLabel = inspection?.created_at
    ? new Date(inspection.created_at).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Not yet serviced'

  const technicianNotesLabel = inspection?.technician_notes?.trim() || 'Not available'

  const doorNumberLabel = door?.door_label || 'Unknown door'
  const doorTypeLabel = door?.door_type || 'Door'
  const suburbLabel = resolvedLocation?.suburb || 'Not available'

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-xl flex-col items-stretch gap-4">
        <header className="text-center">
          <div className="flex flex-col items-center mb-8">
            <Image
              src="/logo.png"
              alt="NBE Australia"
              width={200}
              height={70}
              className="object-contain"
              priority
            />

            <p className="text-xs md:text-sm text-gray-500 mt-2 tracking-wider">
              INDUSTRIAL DOOR INFORMATION
            </p>
          </div>
        </header>

        <main className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading door information…</p>
          ) : error ? (
            <p className="text-sm font-semibold text-red-600">{error}</p>
          ) : !door ? (
            <p className="text-sm font-semibold text-slate-700">
              Door not found. Please contact NBE Australia for assistance.
            </p>
          ) : (
            <div className="space-y-5">
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Door Details
                </h2>
                <div className="grid grid-cols-1 gap-2 text-sm text-slate-800">
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-600">Door Number</span>
                    <span>{doorNumberLabel}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-600">Door Type</span>
                    <span>{doorTypeLabel}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-600">Location</span>
                    <span>{suburbLabel}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-600">Manufactured By</span>
                    <span>NBE Australia</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-600">Installed Date</span>
                    <span>{installDateLabel}</span>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Service Information
                </h2>
                <div className="grid grid-cols-1 gap-2 text-sm text-slate-800">
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-600">Last Serviced</span>
                    <span>{lastServiceDateLabel}</span>
                  </div>
                  {isLoggedIn && (
                    <div className="flex justify-between gap-4">
                      <span className="font-semibold text-slate-600">Technician Notes</span>
                      <span className="max-w-[60%] text-right">
                        {technicianNotesLabel}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-600">Serviced By</span>
                    <span>NBE Australia</span>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Emergency Contact
                </h2>
                <p className="text-sm font-semibold text-slate-900">
                  {EMERGENCY_CONTACT_NUMBER}
                </p>
                <p className="text-xs text-slate-500">
                  For urgent issues with this door, please call NBE Australia.
                </p>
              </section>

              {isLoggedIn && (
                <section className="pt-2">
                  <button
                    type="button"
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                    onClick={() => {
                      window.location.href = `/maintenance/new?doorId=${encodeURIComponent(String(doorId))}`
                    }}
                  >
                    Start Inspection
                  </button>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

