'use client'

import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useAuth } from '@/app/providers/AuthProvider'
import type { ClientLocationRecord, ClientOption, ClientRecord, ClientLocationOption, DoorRecord } from '@/lib/types/maintenance.types'
import {
  createClientSchema,
  csvDoorRowSchema,
} from '@/lib/validation/admin-clients'

type TabKey = 'clients' | 'locations' | 'doors'

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: string }

type CsvImportPreview = {
  inserted: number
  skipped: number
  to_create: number
  errors: Array<{ rowIndex: number; message: string }>
  preview: Array<Record<string, unknown>>
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'clients', label: 'Clients' },
  { key: 'locations', label: 'Locations' },
  { key: 'doors', label: 'Doors' },
]

const csvTemplateHeaders = [
  'client_name',
  'location_name',
  'door_label',
  'door_type',
  'door_description',
  'door_type_alt',
  'cw',
  'ch',
  'install_date',
]

const locationFormSchema = z.object({
  client_id: z.string().uuid('Client is required'),
  location_name: z.string().trim().min(1, 'Location name is required'),
  Company_address: z.string().trim().min(1, 'Address is required'),
  suburb: z.string().optional(),
})

const doorFormSchema = z.object({
  client_location_id: z.string().uuid('Location is required'),
  door_label: z.string().trim().min(1, 'Door label is required'),
  door_type: z.string().trim().min(1, 'Door type is required'),
  door_description: z.string().optional(),
  door_type_alt: z.string().optional(),
  cw: z.string().optional(),
  ch: z.string().optional(),
  install_date: z.string().optional(),
})

export default function AdminClientsPage() {
  const { isAdmin, isManager } = useAuth()
  const canEdit = isAdmin || isManager

  const [activeTab, setActiveTab] = useState<TabKey>('clients')
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [locations, setLocations] = useState<ClientLocationRecord[]>([])
  const [doors, setDoors] = useState<DoorRecord[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [doorSearch, setDoorSearch] = useState('')
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [editingDoor, setEditingDoor] = useState<DoorRecord | null>(null)
  const [showDoorModal, setShowDoorModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvRows, setCsvRows] = useState<Array<z.infer<typeof csvDoorRowSchema>>>([])
  const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvCreateMissing, setCsvCreateMissing] = useState(false)

  const clientForm = useForm<z.infer<typeof createClientSchema>>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { client_name: '' },
  })

  const locationForm = useForm<z.infer<typeof locationFormSchema>>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      client_id: '',
      location_name: '',
      Company_address: '',
      suburb: '',
    },
  })

  const doorForm = useForm<z.infer<typeof doorFormSchema>>({
    resolver: zodResolver(doorFormSchema),
    defaultValues: {
      client_location_id: '',
      door_label: '',
      door_type: '',
      door_description: '',
      door_type_alt: '',
      cw: '',
      ch: '',
      install_date: '',
    },
  })

  const clientOptions: ClientOption[] = useMemo(
    () => clients.map(item => ({ id: item.id, name: item.client_name })),
    [clients],
  )

  const filteredLocationsForClient: ClientLocationOption[] = useMemo(() => {
    const list = locations.filter(item => item.client_id === selectedClientId || !selectedClientId)
    return list.map(item => ({
      id: item.id,
      client_id: item.client_id,
      name: item.location_name,
      address: item.Company_address ?? '',
    }))
  }, [locations, selectedClientId])

  const visibleClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase()
    if (!term) return clients
    return clients.filter(item => item.client_name.toLowerCase().includes(term))
  }, [clients, clientSearch])

  const visibleLocations = useMemo(() => {
    const term = locationSearch.trim().toLowerCase()
    const byClient = locations.filter(item => !selectedClientId || item.client_id === selectedClientId)
    if (!term) return byClient
    return byClient.filter(item =>
      [item.location_name, item.Company_address ?? '', item.suburb ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [locations, locationSearch, selectedClientId])

  const visibleDoors = useMemo(() => {
    const term = doorSearch.trim().toLowerCase()
    const byLocation = doors.filter(item => !selectedLocationId || item.client_location_id === selectedLocationId)
    if (!term) return byLocation
    return byLocation.filter(item =>
      [item.door_label, item.door_type, item.door_description ?? '', item.door_type_alt ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [doors, doorSearch, selectedLocationId])

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
    const response = await fetch(url, init)
    const raw = await response.json().catch(() => ({}))
    const body = raw as { ok?: boolean; data?: T; error?: string }

    if (!response.ok) {
      return { ok: false, error: body.error ?? 'Request failed' }
    }
    if (body.ok === true && body.data !== undefined) {
      return { ok: true, data: body.data }
    }
    if (body.ok === false) {
      return { ok: false, error: body.error ?? 'Request failed' }
    }
    return { ok: false, error: 'Unexpected response' }
  }

  async function loadClients() {
    const response = await fetch('/api/maintenance/clients', { cache: 'no-store' })
    const payload = (await response.json().catch(() => ({}))) as { clients?: ClientOption[] }
    const list = (payload.clients ?? []).map(item => ({
      id: item.id,
      client_name: item.name,
      created_at: null,
    }))
    setClients(list)
  }

  async function loadLocations(clientId: string) {
    if (!clientId) {
      setLocations([])
      return
    }
    const response = await fetch(`/api/maintenance/locations?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
    const payload = (await response.json().catch(() => ({}))) as { locations?: ClientLocationOption[] }
    const list = (payload.locations ?? []).map(item => ({
      id: item.id,
      client_id: item.client_id,
      location_name: item.name,
      Company_address: item.address,
      suburb: item.suburb ?? null,
      created_at: null,
    }))
    setLocations(list)
  }

  async function loadDoors(locationId: string) {
    if (!locationId) {
      setDoors([])
      return
    }
    const response = await fetch(`/api/maintenance/doors?locationId=${encodeURIComponent(locationId)}`, { cache: 'no-store' })
    const payload = (await response.json().catch(() => ({}))) as { doors?: DoorRecord[] }
    setDoors(payload.doors ?? [])
  }

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        await loadClients()
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : 'Failed to load clients')
      } finally {
        if (active) setLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedClientId) {
      setLocations([])
      setSelectedLocationId('')
      setDoors([])
      return
    }
    locationForm.setValue('client_id', selectedClientId, { shouldValidate: false })
    void loadLocations(selectedClientId)
  }, [selectedClientId, locationForm])

  useEffect(() => {
    if (!selectedLocationId) {
      setDoors([])
      return
    }
    void loadDoors(selectedLocationId)
  }, [selectedLocationId])

  async function onSubmitClient(values: z.infer<typeof createClientSchema>) {
    if (!canEdit) return
    const wasEditing = Boolean(editingClientId)
    const url = editingClientId ? `/api/admin/clients/${editingClientId}` : '/api/admin/clients'
    const method = editingClientId ? 'PATCH' : 'POST'
    const result = await fetchJson<ClientRecord>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!result.ok) {
      toast.error(result.error ?? 'Failed to save client')
      return
    }
    const saved = result.data
    setEditingClientId(null)
    clientForm.reset({ client_name: '' })
    await loadClients()

    if (!wasEditing && saved?.id) {
      setSelectedClientId(saved.id)
      setActiveTab('locations')
      locationForm.reset({
        client_id: saved.id,
        location_name: '',
        Company_address: '',
        suburb: '',
      })
      toast.success('Client created — add a location below.')
    } else {
      toast.success(wasEditing ? 'Client updated' : 'Client saved')
    }
  }

  async function onSubmitLocation(values: z.infer<typeof locationFormSchema>) {
    if (!canEdit) return
    const url = editingLocationId ? `/api/admin/client-locations/${editingLocationId}` : '/api/admin/client-locations'
    const method = editingLocationId ? 'PATCH' : 'POST'
    const body = editingLocationId
      ? { location_name: values.location_name, Company_address: values.Company_address, suburb: values.suburb }
      : values

    const result = await fetchJson<ClientLocationRecord>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!result.ok) {
      toast.error(result.error ?? 'Failed to save location')
      return
    }
    toast.success(editingLocationId ? 'Location updated' : 'Location created')
    setEditingLocationId(null)
    locationForm.reset({
      client_id: selectedClientId || '',
      location_name: '',
      Company_address: '',
      suburb: '',
    })
    if (selectedClientId) await loadLocations(selectedClientId)
  }

  async function onSubmitDoor(values: z.infer<typeof doorFormSchema>) {
    if (!canEdit) return
    const url = editingDoor ? `/api/admin/doors/${editingDoor.id}` : '/api/admin/doors'
    const method = editingDoor ? 'PATCH' : 'POST'
    const result = await fetchJson<DoorRecord>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!result.ok) {
      toast.error(result.error ?? 'Failed to save door')
      return
    }
    toast.success(editingDoor ? 'Door updated' : 'Door created')
    setShowDoorModal(false)
    setEditingDoor(null)
    doorForm.reset({
      client_location_id: selectedLocationId || '',
      door_label: '',
      door_type: '',
      door_description: '',
      door_type_alt: '',
      cw: '',
      ch: '',
      install_date: '',
    })
    if (selectedLocationId) await loadDoors(selectedLocationId)
  }

  async function handleDeleteClient(id: string) {
    if (!canEdit) return
    if (!window.confirm('Delete this client? This only works when no locations are attached.')) return
    const result = await fetchJson<{ id: string }>(`/api/admin/clients/${id}`, { method: 'DELETE' })
    if (!result.ok) {
      toast.error(result.error ?? 'Failed to delete client')
      return
    }
    toast.success('Client deleted')
    await loadClients()
    if (selectedClientId === id) setSelectedClientId('')
  }

  async function handleDeleteLocation(id: string) {
    if (!canEdit) return
    if (!window.confirm('Delete this location? This only works when no doors are attached.')) return
    const result = await fetchJson<{ id: string }>(`/api/admin/client-locations/${id}`, { method: 'DELETE' })
    if (!result.ok) {
      toast.error(result.error ?? 'Failed to delete location')
      return
    }
    toast.success('Location deleted')
    if (selectedClientId) await loadLocations(selectedClientId)
    if (selectedLocationId === id) setSelectedLocationId('')
  }

  async function handleDeleteDoor(id: string) {
    if (!canEdit) return
    if (!window.confirm('Delete this door?')) return
    const result = await fetchJson<{ id: string }>(`/api/admin/doors/${id}`, { method: 'DELETE' })
    if (!result.ok) {
      toast.error(result.error ?? 'Failed to delete door')
      return
    }
    toast.success('Door deleted')
    if (selectedLocationId) await loadDoors(selectedLocationId)
  }

  function startEditClient(client: ClientRecord) {
    setEditingClientId(client.id)
    clientForm.reset({ client_name: client.client_name })
  }

  function startEditLocation(location: ClientLocationRecord) {
    setEditingLocationId(location.id)
    locationForm.reset({
      client_id: location.client_id,
      location_name: location.location_name,
      Company_address: location.Company_address ?? '',
      suburb: location.suburb ?? '',
    })
  }

  function openCreateDoorModal() {
    setEditingDoor(null)
    doorForm.reset({
      client_location_id: selectedLocationId || '',
      door_label: '',
      door_type: '',
      door_description: '',
      door_type_alt: '',
      cw: '',
      ch: '',
      install_date: '',
    })
    setShowDoorModal(true)
  }

  function openEditDoorModal(door: DoorRecord) {
    setEditingDoor(door)
    doorForm.reset({
      client_location_id: door.client_location_id,
      door_label: door.door_label,
      door_type: door.door_type,
      door_description: door.door_description ?? '',
      door_type_alt: door.door_type_alt ?? '',
      cw: door.cw ?? '',
      ch: door.ch ?? '',
      install_date: door.install_date ?? '',
    })
    setShowDoorModal(true)
  }

  function downloadCsvTemplate() {
    const csv = `${csvTemplateHeaders.join(',')}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'door-import-template.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleCsvFile(file: File) {
    setCsvPreview(null)
    setCsvRows([])
    setCsvLoading(true)
    try {
      const Papa = await import('papaparse')
      const text = await file.text()
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      })
      const rows = parsed.data.map(row =>
        csvDoorRowSchema.parse({
          client_name: row.client_name,
          location_name: row.location_name,
          door_label: row.door_label,
          door_type: row.door_type,
          door_description: row.door_description,
          door_type_alt: row.door_type_alt,
          cw: row.cw,
          ch: row.ch,
          install_date: row.install_date,
        }),
      )
      setCsvRows(rows)

      const preview = await fetchJson<CsvImportPreview>('/api/admin/doors/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, createMissing: csvCreateMissing, preview: true }),
      })
      if (!preview.ok) {
        toast.error(preview.error ?? 'Preview failed')
        return
      }
      setCsvPreview(preview.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid CSV file')
    } finally {
      setCsvLoading(false)
    }
  }

  async function confirmCsvImport() {
    if (!csvRows.length) {
      toast.error('Choose a CSV file first')
      return
    }
    setCsvLoading(true)
    try {
      const result = await fetchJson<{ inserted: number; skipped: number; errors: Array<{ rowIndex: number; message: string }> }>(
        '/api/admin/doors/import-csv',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: csvRows, createMissing: csvCreateMissing }),
        },
      )
      if (!result.ok) {
        toast.error(result.error ?? 'Import failed')
        return
      }

      toast.success(`Import complete: ${result.data.inserted} inserted, ${result.data.skipped} skipped`)
      setShowCsvModal(false)
      setCsvRows([])
      setCsvPreview(null)
      if (selectedLocationId) await loadDoors(selectedLocationId)
    } finally {
      setCsvLoading(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-600">Loading client registry...</div>
  }

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Clients & Doors</h1>
        <p className="mt-1 text-sm text-slate-600">Create clients, locations, and doors from UI. Managers and admins only.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm ${activeTab === tab.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'clients' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Clients</h2>
            <input
              value={clientSearch}
              onChange={event => setClientSearch(event.target.value)}
              placeholder="Search clients..."
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <form className="mb-4 flex flex-wrap gap-2" onSubmit={clientForm.handleSubmit(onSubmitClient)}>
            <input {...clientForm.register('client_name')} placeholder="Client name" className="h-10 min-w-[240px] rounded-lg border border-slate-300 px-3 text-sm" />
            <button disabled={!canEdit} type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-50">
              {editingClientId ? 'Update client' : 'Create client'}
            </button>
            {editingClientId && (
              <button
                type="button"
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm"
                onClick={() => {
                  setEditingClientId(null)
                  clientForm.reset({ client_name: '' })
                }}
              >
                Cancel
              </button>
            )}
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map(client => (
                  <tr key={client.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{client.client_name}</td>
                    <td className="px-3 py-2 text-right">
                      <button disabled={!canEdit} type="button" className="mr-2 text-indigo-700 underline disabled:opacity-40" onClick={() => startEditClient(client)}>Edit</button>
                      <button disabled={!canEdit} type="button" className="text-red-700 underline disabled:opacity-40" onClick={() => handleDeleteClient(client.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'locations' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <select
              value={selectedClientId}
              onChange={event => {
                const value = event.target.value
                setSelectedClientId(value)
                locationForm.setValue('client_id', value)
              }}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">Select client</option>
              {clientOptions.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <input
              value={locationSearch}
              onChange={event => setLocationSearch(event.target.value)}
              placeholder="Search locations..."
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <form className="mb-4 grid gap-2 md:grid-cols-5" onSubmit={locationForm.handleSubmit(onSubmitLocation)}>
            <select {...locationForm.register('client_id')} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
              <option value="">Select client</option>
              {clientOptions.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <input {...locationForm.register('location_name')} placeholder="Location name" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            <input {...locationForm.register('Company_address')} placeholder="Address" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            <input {...locationForm.register('suburb')} placeholder="Suburb (optional)" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
            <div className="flex gap-2">
              <button disabled={!canEdit} type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-50">
                {editingLocationId ? 'Update location' : 'Create location'}
              </button>
              {editingLocationId && (
                <button
                  type="button"
                  className="h-10 rounded-lg border border-slate-300 px-4 text-sm"
                  onClick={() => {
                    setEditingLocationId(null)
                    locationForm.reset({
                      client_id: selectedClientId || '',
                      location_name: '',
                      Company_address: '',
                      suburb: '',
                    })
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Suburb</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLocations.map(location => (
                  <tr key={location.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{location.location_name}</td>
                    <td className="px-3 py-2 text-slate-700">{location.Company_address ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{location.suburb ?? '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <button disabled={!canEdit} type="button" className="mr-2 text-indigo-700 underline disabled:opacity-40" onClick={() => startEditLocation(location)}>Edit</button>
                      <button disabled={!canEdit} type="button" className="text-red-700 underline disabled:opacity-40" onClick={() => handleDeleteLocation(location.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'doors' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <select
              value={selectedClientId}
              onChange={event => setSelectedClientId(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">Select client</option>
              {clientOptions.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <select
              value={selectedLocationId}
              onChange={event => setSelectedLocationId(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">Select location</option>
              {filteredLocationsForClient.map(location => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
            <input
              value={doorSearch}
              onChange={event => setDoorSearch(event.target.value)}
              placeholder="Search doors..."
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
            <div className="flex gap-2">
              <button disabled={!canEdit} type="button" onClick={openCreateDoorModal} className="h-10 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white disabled:opacity-50">
                Add Door
              </button>
              <button disabled={!canEdit} type="button" onClick={() => setShowCsvModal(true)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50">
                Import CSV
              </button>
              <button type="button" onClick={downloadCsvTemplate} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
                Download Template
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">Door Label</th>
                  <th className="px-3 py-2">Door Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDoors.map(door => (
                  <tr key={door.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{door.door_label}</td>
                    <td className="px-3 py-2 text-slate-700">{door.door_type}</td>
                    <td className="px-3 py-2 text-slate-700">{door.door_description ?? '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <button disabled={!canEdit} type="button" className="mr-2 text-indigo-700 underline disabled:opacity-40" onClick={() => openEditDoorModal(door)}>Edit</button>
                      <button disabled={!canEdit} type="button" className="text-red-700 underline disabled:opacity-40" onClick={() => handleDeleteDoor(door.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showDoorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{editingDoor ? 'Edit door' : 'Add door'}</h3>
            <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={doorForm.handleSubmit(onSubmitDoor)}>
              <select {...doorForm.register('client_location_id')} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
                <option value="">Select location</option>
                {filteredLocationsForClient.map(location => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
              <input {...doorForm.register('door_label')} placeholder="Door label" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
              <input {...doorForm.register('door_type')} placeholder="Door type" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
              <input {...doorForm.register('install_date')} type="date" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
              <input {...doorForm.register('door_description')} placeholder="Door description" className="h-10 rounded-lg border border-slate-300 px-3 text-sm md:col-span-2" />
              <input {...doorForm.register('door_type_alt')} placeholder="Door type alt" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
              <input {...doorForm.register('cw')} placeholder="CW" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
              <input {...doorForm.register('ch')} placeholder="CH" className="h-10 rounded-lg border border-slate-300 px-3 text-sm" />
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" className="h-10 rounded-lg border border-slate-300 px-4 text-sm" onClick={() => setShowDoorModal(false)}>Cancel</button>
                <button disabled={!canEdit} type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-50">{editingDoor ? 'Save changes' : 'Create door'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Import doors from CSV</h3>
            <p className="mt-1 text-sm text-slate-600">Upload CSV, review dry-run results, then confirm import.</p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) void handleCsvFile(file)
                }}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={csvCreateMissing}
                  onChange={event => setCsvCreateMissing(event.target.checked)}
                />
                Auto-create missing clients/locations
              </label>
            </div>

            {csvLoading && <p className="mt-3 text-sm text-slate-600">Processing CSV...</p>}

            {csvPreview && (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p>Rows to create: <strong>{csvPreview.to_create}</strong></p>
                  <p>Skipped rows: <strong>{csvPreview.skipped}</strong></p>
                  <p>Error rows: <strong>{csvPreview.errors.length}</strong></p>
                </div>

                {csvPreview.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {csvPreview.errors.slice(0, 30).map(item => (
                      <p key={`${item.rowIndex}-${item.message}`}>Row {item.rowIndex}: {item.message}</p>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        {csvTemplateHeaders.map(header => (
                          <th key={header} className="px-2 py-1">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 10).map((row, index) => (
                        <tr key={`${row.client_name}-${row.location_name}-${index}`} className="border-t border-slate-100">
                          <td className="px-2 py-1">{row.client_name}</td>
                          <td className="px-2 py-1">{row.location_name}</td>
                          <td className="px-2 py-1">{row.door_label}</td>
                          <td className="px-2 py-1">{row.door_type}</td>
                          <td className="px-2 py-1">{row.door_description ?? ''}</td>
                          <td className="px-2 py-1">{row.door_type_alt ?? ''}</td>
                          <td className="px-2 py-1">{row.cw ?? ''}</td>
                          <td className="px-2 py-1">{row.ch ?? ''}</td>
                          <td className="px-2 py-1">{row.install_date ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="h-10 rounded-lg border border-slate-300 px-4 text-sm" onClick={() => setShowCsvModal(false)}>
                Close
              </button>
              <button
                type="button"
                className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                disabled={!canEdit || csvLoading || !csvRows.length}
                onClick={() => void confirmCsvImport()}
              >
                Confirm import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
