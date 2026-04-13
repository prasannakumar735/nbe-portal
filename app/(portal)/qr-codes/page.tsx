'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { createSupabaseClient } from '@/lib/supabase/client'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import type { ClientLocationOption, ClientOption } from '@/lib/types/maintenance.types'

type DoorOption = {
  id: string
  door_label: string
  door_type: string
}

export default function QrCodesPage() {
  const { profile, isLoading } = useAuth()
  const supabase = useMemo(() => createSupabaseClient(), [])

  const [clients, setClients] = useState<ClientOption[]>([])
  const [locations, setLocations] = useState<ClientLocationOption[]>([])
  const [doors, setDoors] = useState<DoorOption[]>([])

  const [clientId, setClientId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [doorId, setDoorId] = useState('')

  const [error, setError] = useState('')

  const isAllowed = canApproveMaintenanceReport(profile ?? undefined)

  const selectedDoor = doors.find(item => item.id === doorId)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

  const qrTargetUrl = doorId ? `${baseUrl}/door/${encodeURIComponent(doorId)}` : ''
  const qrImageUrl = doorId ? `/api/qr/door/${encodeURIComponent(doorId)}` : ''

  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await fetch('/api/maintenance/clients', { cache: 'no-store' })
        const data = (await response.json()) as { clients?: ClientOption[] }
        setClients(data.clients ?? [])
      } catch {
        setClients([])
      }
    }

    void loadClients()
  }, [])

  useEffect(() => {
    const loadLocations = async () => {
      if (!clientId) {
        setLocations([])
        setLocationId('')
        setDoors([])
        setDoorId('')
        return
      }

      try {
        const response = await fetch(`/api/maintenance/locations?clientId=${encodeURIComponent(clientId)}`, {
          cache: 'no-store',
        })
        const data = (await response.json()) as { locations?: ClientLocationOption[] }
        setLocations(data.locations ?? [])
      } catch {
        setLocations([])
      }

      setLocationId('')
      setDoors([])
      setDoorId('')
    }

    void loadLocations()
  }, [clientId])

  useEffect(() => {
    const loadDoors = async () => {
      if (!locationId) {
        setDoors([])
        setDoorId('')
        return
      }

      const { data, error: queryError } = await supabase
        .from('doors')
        .select('id, door_label, door_type')
        .eq('client_location_id', locationId)
        .order('door_label', { ascending: true })

      if (queryError) {
        setDoors([])
        setError('Failed to load doors for selected location.')
        return
      }

      const options = (data ?? []).map(row => ({
        id: String(row.id ?? ''),
        door_label: String(row.door_label ?? '').trim() || 'Unnamed door',
        door_type: String(row.door_type ?? '').trim() || 'Door',
      }))

      setDoors(options)
      setDoorId('')
      setError('')
    }

    void loadDoors()
  }, [locationId, supabase])

  const handleDownload = async () => {
    if (!doorId || !qrImageUrl) return

    try {
      const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Failed to load image.'))
        img.src = src
      })

      const [logoImage, qrImage] = await Promise.all([
        loadImage('/logo_QR_code.png'),
        loadImage(qrImageUrl),
      ])

      const canvas = document.createElement('canvas')
      const width = 900
      const height = 1260
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Failed to generate QR code image.')

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)

      const logoWidth = 480
      const logoHeight = 250
      const logoX = (width - logoWidth) / 2
      const logoY = 50
      context.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight)

      context.fillStyle = '#0f172a'
      context.textAlign = 'center'
      context.font = 'bold 66px Arial'
      context.fillText('(03) 9357 5858', width / 2, 390)
      context.font = 'bold 60px Arial'
      context.fillText('service@nbeaustralia.com.au', width / 2, 470)

      const qrWrapperX = 140
      const qrWrapperY = 530
      const qrWrapperSize = 620
      const radius = 14

      context.fillStyle = '#ffffff'
      context.beginPath()
      context.moveTo(qrWrapperX + radius, qrWrapperY)
      context.lineTo(qrWrapperX + qrWrapperSize - radius, qrWrapperY)
      context.quadraticCurveTo(qrWrapperX + qrWrapperSize, qrWrapperY, qrWrapperX + qrWrapperSize, qrWrapperY + radius)
      context.lineTo(qrWrapperX + qrWrapperSize, qrWrapperY + qrWrapperSize - radius)
      context.quadraticCurveTo(qrWrapperX + qrWrapperSize, qrWrapperY + qrWrapperSize, qrWrapperX + qrWrapperSize - radius, qrWrapperY + qrWrapperSize)
      context.lineTo(qrWrapperX + radius, qrWrapperY + qrWrapperSize)
      context.quadraticCurveTo(qrWrapperX, qrWrapperY + qrWrapperSize, qrWrapperX, qrWrapperY + qrWrapperSize - radius)
      context.lineTo(qrWrapperX, qrWrapperY + radius)
      context.quadraticCurveTo(qrWrapperX, qrWrapperY, qrWrapperX + radius, qrWrapperY)
      context.closePath()
      context.fill()

      const qrInset = 36
      context.drawImage(
        qrImage,
        qrWrapperX + qrInset,
        qrWrapperY + qrInset,
        qrWrapperSize - qrInset * 2,
        qrWrapperSize - qrInset * 2,
      )

      const pngDataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      const safeDoorName = (selectedDoor?.door_label || 'door').replace(/\s+/g, '-').toLowerCase()
      link.href = pngDataUrl
      link.download = `door-qr-${safeDoorName}.png`
      link.click()
    } catch {
      setError('Failed to download QR code.')
    }
  }

  if (isLoading) {
    return <div className="py-6 text-sm text-slate-600">Loading...</div>
  }

  if (!isAllowed) {
    return (
      <div className="py-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          Only managers can generate door QR codes.
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/Logo_black.png" alt="NBE Australia" className="h-20 w-auto object-contain" />
          <h1 className="text-xl font-black tracking-wide text-slate-900">QR Code Generator</h1>
          <p className="text-sm text-slate-600">Generate printable industrial door QR codes.</p>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Client
            <select
              value={clientId}
              onChange={event => setClientId(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3"
            >
              <option value="">Select client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Location
            <select
              value={locationId}
              onChange={event => setLocationId(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3"
              disabled={!clientId}
            >
              <option value="">Select location</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Door
            <select
              value={doorId}
              onChange={event => setDoorId(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3"
              disabled={!locationId}
            >
              <option value="">Select door</option>
              {doors.map(door => (
                <option key={door.id} value={door.id}>{door.door_label} ({door.door_type})</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </section>

      {doorId && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-slate-300 bg-white p-4 text-center">
            <img
              src="/logo_QR_code.png"
              alt="NBE Australia"
              className="h-28 w-auto object-contain"
            />

            <div className="-mt-2 text-center leading-tight">
              <p className="text-2xl font-bold text-slate-900">(03) 9357 5858</p>
              <p className="text-[20px] font-bold text-slate-900">service@nbeaustralia.com.au</p>
            </div>

            <div className="rounded-md bg-white p-2">
              <img src={qrImageUrl} alt="Door QR code" className="h-56 w-56" />
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <a
                href={baseUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                View QR Code
              </a>
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="h-11 flex-1 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Download QR Code
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
