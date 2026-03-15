'use client'

import { useEffect, useMemo, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { ClientLocationOption, ClientOption } from '@/lib/types/maintenance.types'

type DoorWithLocation = {
  id: string
  door_label: string | null
  door_type: string | null
  client_locations:
    | null
    | {
        suburb?: string | null
      }
}

export default function DoorQrStickersPage() {
  const supabase = useMemo(() => createSupabaseClient(), [])

  const [doors, setDoors] = useState<DoorWithLocation[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [locations, setLocations] = useState<ClientLocationOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await fetch('/api/maintenance/clients')
        const data = (await response.json()) as { clients?: ClientOption[] }
        setClients(data.clients ?? [])
      } catch {
        // Non-critical for QR stickers; filters will just be empty
        setClients([])
      }
    }

    void loadClients()
  }, [])

  useEffect(() => {
    const loadLocationsForClient = async (clientId: string) => {
      if (!clientId) {
        setLocations([])
        return
      }

      const response = await fetch(
        `/api/maintenance/locations?clientId=${encodeURIComponent(clientId)}`,
      )
      const data = (await response.json()) as { locations?: ClientLocationOption[] }
      setLocations(data.locations ?? [])
    }

    if (selectedClientId) {
      void loadLocationsForClient(selectedClientId)
    } else {
      setLocations([])
      setSelectedLocationId('')
    }
  }, [selectedClientId])

  useEffect(() => {
    const loadDoors = async () => {
      setIsLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('doors')
          .select(
            `
            id,
            door_label,
            door_type,
            client_locations(suburb)
          `,
          )
          .order('door_label', { ascending: true })

        if (selectedLocationId) {
          query = query.eq('client_location_id', selectedLocationId)
        }

        const { data, error: queryError } = await query

        if (queryError) {
          console.error('[DoorQrStickersPage] Failed to load doors:', queryError)
          setError('Failed to load doors.')
          setDoors([])
          return
        }

        const nextDoors = (data ?? []).map(row => {
          const record = row as DoorWithLocation
          return {
            id: String(record.id),
            door_label: record.door_label,
            door_type: record.door_type,
            client_locations: record.client_locations,
          }
        })

        setDoors(nextDoors)
      } catch (err) {
        console.error('[DoorQrStickersPage] Unexpected error loading doors:', err)
        setError('Failed to load doors.')
        setDoors([])
      } finally {
        setIsLoading(false)
      }
    }

    void loadDoors()
  }, [selectedLocationId, supabase])

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-4 flex flex-col gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-lg font-black text-slate-900">QR Door Stickers</h1>
            <p className="mt-1 text-sm text-slate-600">
              Printable QR stickers for all registered doors.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Print QR Stickers
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-slate-700">Client</span>
            <select
              value={selectedClientId}
              onChange={event => {
                setSelectedClientId(event.target.value)
                setSelectedLocationId('')
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="">All clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="text-slate-700">Location</span>
            <select
              value={selectedLocationId}
              onChange={event => setSelectedLocationId(event.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              disabled={!selectedClientId}
            >
              <option value="">All locations</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm text-slate-600">Loading doors…</p>
      ) : error ? (
        <p className="text-sm font-semibold text-red-600">{error}</p>
      ) : doors.length === 0 ? (
        <p className="text-sm text-slate-600">No doors found.</p>
      ) : (
        <main className="print:mt-0">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 print:grid print:grid-cols-3 print:gap-6">
            {doors.map(door => {
              const suburb =
                (door.client_locations && 'suburb' in door.client_locations
                  ? door.client_locations.suburb
                  : null) || 'N/A'

              return (
                <section
                  key={door.id}
                  className="flex h-64 w-64 flex-col items-center justify-between rounded-xl border border-slate-300 bg-white p-3 text-center shadow-sm print:h-64 print:w-64"
                >
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">
                      NBE Australia
                    </h2>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Industrial Door QR Sticker
                    </p>

                    <div className="mt-3 space-y-1 text-xs text-slate-800">
                      <p>
                        <span className="font-semibold">Door:</span>{' '}
                        {door.door_label || 'Unnamed Door'}
                      </p>
                      <p>
                        <span className="font-semibold">Type:</span>{' '}
                        {door.door_type || 'Door'}
                      </p>
                      <p>
                        <span className="font-semibold">Location:</span> {suburb}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 items-center justify-center">
                    <img
                      src={`/api/qr/door/${encodeURIComponent(door.id)}`}
                      alt={`QR code for door ${door.door_label || door.id}`}
                      className="h-28 w-28"
                    />
                  </div>

                  <div className="mt-2 text-[11px] leading-tight text-slate-900">
                    <p className="font-semibold">Emergency Service</p>
                    <p className="font-bold">1300 XXX XXX</p>
                  </div>
                </section>
              )
            })}
          </div>
        </main>
      )}
    </div>
  )
}

