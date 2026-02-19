'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TopNavigation } from '../components/TopNavigation'
import { AlertCircle, CheckCircle, Play, Square } from 'lucide-react'

interface TimeEntry {
  id: string
  employee_id: string
  client_id: string
  location_id: string
  level1_id: string
  level2_id: string
  billable: boolean
  start_time: string
  end_time: string | null
  hours: number | null
  status: 'active' | 'completed'
  created_at: string
  updated_at?: string
}

interface Client {
  id: string
  name: string
}

interface ClientLocation {
  id: string
  client_id: string
  suburb: string
}

interface WorkTypeLevel1 {
  id: string
  code: string
  name: string
}

interface WorkTypeLevel2 {
  id: string
  level1_id: string
  code: string
  name: string
  billable: boolean
}

export default function TimeCardPage() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')

  const [clients, setClients] = useState<Client[]>([])
  const [locations, setLocations] = useState<ClientLocation[]>([])
  const [workTypesL1, setWorkTypesL1] = useState<WorkTypeLevel1[]>([])
  const [workTypesL2, setWorkTypesL2] = useState<WorkTypeLevel2[]>([])

  const [entryLocationLookup, setEntryLocationLookup] = useState<Record<string, ClientLocation>>({})
  const [entryLevel2Lookup, setEntryLevel2Lookup] = useState<Record<string, WorkTypeLevel2>>({})

  const [selectedClient, setSelectedClient] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedLevel1, setSelectedLevel1] = useState('')
  const [selectedLevel2, setSelectedLevel2] = useState('')

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const clearMessages = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })

  const loadBaseOptions = useCallback(async () => {
    try {
      const [{ data: clientRows, error: clientError }, { data: l1Rows, error: l1Error }] = await Promise.all([
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase.from('work_type_level1').select('id, code, name').order('code', { ascending: true })
      ])

      if (clientError) throw clientError
      if (l1Error) throw l1Error

      setClients(clientRows || [])
      setWorkTypesL1(l1Rows || [])
    } catch (error) {
      console.error('[timecard] loadBaseOptions failed:', error)
      setErrorMessage('Failed to load form options.')
    }
  }, [])

  const loadLocationsByClient = useCallback(async (clientId: string) => {
    if (!clientId) {
      setLocations([])
      setSelectedLocation('')
      return
    }

    try {
      const { data, error } = await supabase
        .from('client_locations')
        .select('id, client_id, suburb')
        .eq('client_id', clientId)
        .order('suburb', { ascending: true })

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('[timecard] loadLocationsByClient failed:', error)
      setErrorMessage('Failed to load locations for selected client.')
    }
  }, [])

  const loadLevel2ByLevel1 = useCallback(async (level1Id: string) => {
    if (!level1Id) {
      setWorkTypesL2([])
      setSelectedLevel2('')
      return
    }

    try {
      const { data, error } = await supabase
        .from('work_type_level2')
        .select('id, level1_id, code, name, billable')
        .eq('level1_id', level1Id)
        .order('code', { ascending: true })

      if (error) throw error
      setWorkTypesL2(data || [])
    } catch (error) {
      console.error('[timecard] loadLevel2ByLevel1 failed:', error)
      setErrorMessage('Failed to load tasks for selected work type.')
    }
  }, [])

  const buildEntryLookups = useCallback(async (rows: TimeEntry[]) => {
    const locationIds = [...new Set(rows.map((entry) => entry.location_id).filter(Boolean))]
    const level2Ids = [...new Set(rows.map((entry) => entry.level2_id).filter(Boolean))]

    if (locationIds.length > 0) {
      const { data, error } = await supabase
        .from('client_locations')
        .select('id, client_id, suburb')
        .in('id', locationIds)

      if (!error && data) {
        const map: Record<string, ClientLocation> = {}
        data.forEach((row) => {
          map[row.id] = row
        })
        setEntryLocationLookup(map)
      }
    } else {
      setEntryLocationLookup({})
    }

    if (level2Ids.length > 0) {
      const { data, error } = await supabase
        .from('work_type_level2')
        .select('id, level1_id, code, name, billable')
        .in('id', level2Ids)

      if (!error && data) {
        const map: Record<string, WorkTypeLevel2> = {}
        data.forEach((row) => {
          map[row.id] = row
        })
        setEntryLevel2Lookup(map)
      }
    } else {
      setEntryLevel2Lookup({})
    }
  }, [])

  const loadEntries = useCallback(
    async (employeeId: string) => {
      if (!employeeId) {
        console.error('[timecard] loadEntries missing employeeId')
        return
      }

      try {
        setIsLoadingEntries(true)

        const { data, error } = await supabase
          .from('time_entries')
          .select('id, employee_id, client_id, location_id, level1_id, level2_id, billable, start_time, end_time, hours, status, created_at, updated_at')
          .eq('employee_id', employeeId)
          .order('start_time', { ascending: false })

        if (error) throw error

        const rows = (data || []) as TimeEntry[]
        setEntries(rows)

        const active = rows.find((entry) => entry.status === 'active' && !entry.end_time) || null
        setActiveEntry(active)

        await buildEntryLookups(rows)
      } catch (error) {
        console.error('[timecard] loadEntries failed:', error)
        setErrorMessage('Failed to load weekly activity.')
      } finally {
        setIsLoadingEntries(false)
      }
    },
    [buildEntryLookups]
  )

  useEffect(() => {
    if (!activeEntry) {
      setElapsedTime('00:00:00')
      return
    }

    const interval = setInterval(() => {
      const start = new Date(activeEntry.start_time)
      const diff = Date.now() - start.getTime()
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      setElapsedTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
    }, 1000)

    return () => clearInterval(interval)
  }, [activeEntry])

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) {
          router.push('/')
          return
        }

        setUser(data.user)
        await loadBaseOptions()
        await loadEntries(data.user.id)
      } catch (error) {
        console.error('[timecard] auth check failed:', error)
        router.push('/')
      } finally {
        setIsLoadingPage(false)
      }
    }

    checkUser()
  }, [router, loadBaseOptions, loadEntries])

  const handleClientChange = async (clientId: string) => {
    setSelectedClient(clientId)
    setSelectedLocation('')
    setLocations([])
    await loadLocationsByClient(clientId)
  }

  const handleLevel1Change = async (level1Id: string) => {
    setSelectedLevel1(level1Id)
    setSelectedLevel2('')
    setWorkTypesL2([])
    await loadLevel2ByLevel1(level1Id)
  }

  const handleStartWork = async () => {
    clearMessages()

    if (!user?.id || !selectedClient || !selectedLocation || !selectedLevel1 || !selectedLevel2) {
      setErrorMessage('Please complete all fields before starting work.')
      return
    }

    if (activeEntry) {
      setErrorMessage('You already have an active session. Stop it before starting another.')
      return
    }

    const selectedL2 = workTypesL2.find((row) => row.id === selectedLevel2)
    const billable = selectedL2?.billable ?? false

    try {
      setIsSubmitting(true)

      const payload = {
        employee_id: user.id,
        client_id: selectedClient,
        location_id: selectedLocation,
        level1_id: selectedLevel1,
        level2_id: selectedLevel2,
        billable,
        start_time: new Date().toISOString(),
        status: 'active'
      }

      const { error } = await supabase.from('time_entries').insert([payload])
      if (error) throw error

      setSuccessMessage('Work session started successfully.')
      await loadEntries(user.id)
    } catch (error) {
      console.error('[timecard] handleStartWork failed:', error)
      setErrorMessage('Failed to start work session.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStopWork = async () => {
    clearMessages()

    if (!user?.id || !activeEntry?.id) {
      setErrorMessage('No active work session to stop.')
      return
    }

    try {
      setIsSubmitting(true)

      const now = new Date()
      const start = new Date(activeEntry.start_time)
      const hours = Number(((now.getTime() - start.getTime()) / 3600000).toFixed(2))

      const payload = {
        end_time: now.toISOString(),
        hours,
        status: 'completed'
      }

      const { error } = await supabase.from('time_entries').update(payload).eq('id', activeEntry.id)
      if (error) throw error

      setSuccessMessage('Work session completed.')
      await loadEntries(user.id)
    } catch (error) {
      console.error('[timecard] handleStopWork failed:', error)
      setErrorMessage('Failed to stop work session.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const weeklyTotal = useMemo(() => {
    return entries.reduce((sum, row) => sum + (row.hours || 0), 0).toFixed(2)
  }, [entries])

  if (isLoadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 mx-auto mb-4" style={{ borderColor: '#E5E7EB', borderTopColor: '#5B21B6' }}></div>
          <p className="text-sm" style={{ color: '#475569' }}>Loading timecard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      <TopNavigation user={user} />

      <div
        className="border-b"
        style={{
          background: 'linear-gradient(135deg, #0B1020 0%, #1E1B4B 65%, #312E81 100%)',
          borderColor: 'rgba(255,255,255,0.08)'
        }}
      >
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-8">
          <div className="rounded-xl border px-6 py-5 backdrop-blur-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Timecard & GPS Tracking</h1>
              <p className="text-sm mt-2" style={{ color: '#CBD5E1' }}>
                Track and manage your work hours efficiently
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full" style={{ backgroundColor: '#DCFCE7' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#16A34A' }}></span>
              <span className="text-xs font-semibold" style={{ color: '#166534' }}>
                {activeEntry ? 'Active Tracking' : 'Ready to Start'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-8">
        {(errorMessage || successMessage) && (
          <div className="space-y-2 mb-8 animate-fade-in">
            {errorMessage && (
              <div className="rounded-xl border p-4 flex items-start gap-3" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
                <AlertCircle size={18} style={{ color: '#DC2626' }} className="mt-0.5" />
                <p className="text-sm" style={{ color: '#7F1D1D' }}>{errorMessage}</p>
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border p-4 flex items-start gap-3" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                <CheckCircle size={18} style={{ color: '#16A34A' }} className="mt-0.5" />
                <p className="text-sm" style={{ color: '#166534' }}>{successMessage}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-8">
          {activeEntry && (
            <section className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#F3F4F6', position: 'relative', overflow: 'hidden' }}>
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#5B21B6' }}></div>

              <div className="ml-3 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-4 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#16A34A' }}></span>
                    <span className="text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Active Session</span>
                  </div>
                  <p className="text-4xl font-semibold font-mono" style={{ color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{elapsedTime}</p>
                  <p className="text-sm mt-2" style={{ color: '#6B7280' }}>Started at {formatTime(activeEntry.start_time)}</p>
                </div>

                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Client</p>
                    <p className="text-base font-medium" style={{ color: '#111827' }}>{clients.find((row) => row.id === activeEntry.client_id)?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Location</p>
                    <p className="text-base font-medium" style={{ color: '#111827' }}>{entryLocationLookup[activeEntry.location_id]?.suburb || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Work Type</p>
                    <p className="text-base font-medium" style={{ color: '#111827' }}>{workTypesL1.find((row) => row.id === activeEntry.level1_id)?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Task</p>
                    <p className="text-base font-medium" style={{ color: '#111827' }}>{entryLevel2Lookup[activeEntry.level2_id]?.name || '—'}</p>
                  </div>
                </div>

                <div className="lg:col-span-3 flex lg:justify-end">
                  <button
                    onClick={handleStopWork}
                    disabled={isSubmitting}
                    className="w-full lg:w-auto px-6 h-11 rounded-lg text-white font-medium transition duration-200 hover:scale-[1.03] disabled:opacity-50"
                    style={{ backgroundColor: '#DC2626' }}
                  >
                    <span className="inline-flex items-center gap-2"><Square size={14} /> Stop Work</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#F3F4F6' }}>
            <h2 className="text-2xl font-semibold" style={{ color: '#111827' }}>Work Entry</h2>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm uppercase tracking-wide block mb-2" style={{ color: '#6B7280' }}>Client</label>
                <select
                  value={selectedClient}
                  onChange={(e) => handleClientChange(e.target.value)}
                  disabled={!!activeEntry}
                  className="w-full h-11 rounded-lg border px-3 text-sm transition duration-200 focus:outline-none focus:ring-2 disabled:opacity-50"
                  style={{ borderColor: '#D1D5DB', color: '#111827', '--tw-ring-color': '#5B21B6' } as any}
                >
                  <option value="">Select client</option>
                  {clients.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm uppercase tracking-wide block mb-2" style={{ color: '#6B7280' }}>Location</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  disabled={!selectedClient || !!activeEntry}
                  className="w-full h-11 rounded-lg border px-3 text-sm transition duration-200 focus:outline-none focus:ring-2 disabled:opacity-50"
                  style={{ borderColor: '#D1D5DB', color: '#111827', '--tw-ring-color': '#5B21B6' } as any}
                >
                  <option value="">Select location</option>
                  {locations.map((row) => (
                    <option key={row.id} value={row.id}>{row.suburb}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm uppercase tracking-wide block mb-2" style={{ color: '#6B7280' }}>Work Type</label>
                <select
                  value={selectedLevel1}
                  onChange={(e) => handleLevel1Change(e.target.value)}
                  disabled={!!activeEntry}
                  className="w-full h-11 rounded-lg border px-3 text-sm transition duration-200 focus:outline-none focus:ring-2 disabled:opacity-50"
                  style={{ borderColor: '#D1D5DB', color: '#111827', '--tw-ring-color': '#5B21B6' } as any}
                >
                  <option value="">Select work type</option>
                  {workTypesL1.map((row) => (
                    <option key={row.id} value={row.id}>{row.code} - {row.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm uppercase tracking-wide block mb-2" style={{ color: '#6B7280' }}>Task</label>
                <select
                  value={selectedLevel2}
                  onChange={(e) => setSelectedLevel2(e.target.value)}
                  disabled={!selectedLevel1 || !!activeEntry}
                  className="w-full h-11 rounded-lg border px-3 text-sm transition duration-200 focus:outline-none focus:ring-2 disabled:opacity-50"
                  style={{ borderColor: '#D1D5DB', color: '#111827', '--tw-ring-color': '#5B21B6' } as any}
                >
                  <option value="">Select task</option>
                  {workTypesL2.map((row) => (
                    <option key={row.id} value={row.id}>{row.code} - {row.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {!activeEntry && (
              <button
                onClick={handleStartWork}
                disabled={isSubmitting || !selectedClient || !selectedLocation || !selectedLevel1 || !selectedLevel2}
                className="mt-6 w-full md:w-auto px-8 h-11 rounded-lg text-white font-medium transition duration-200 hover:scale-[1.03] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)' }}
              >
                <span className="inline-flex items-center gap-2"><Play size={14} /> {isSubmitting ? 'Starting...' : 'Start Work'}</span>
              </button>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#F3F4F6' }}>
              <p className="text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Entries This Week</p>
              <p className="text-2xl font-semibold mt-2" style={{ color: '#111827' }}>{entries.length}</p>
            </div>
            <div className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#F3F4F6' }}>
              <p className="text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Total Hours</p>
              <p className="text-2xl font-semibold mt-2" style={{ color: '#111827' }}>{weeklyTotal}</p>
            </div>
          </section>

          <section className="rounded-xl border shadow-sm" style={{ backgroundColor: '#FFFFFF', borderColor: '#F3F4F6' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-2xl font-semibold" style={{ color: '#111827' }}>Weekly Activity</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB' }}>
                    <th className="px-6 py-3 text-left text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Date</th>
                    <th className="px-6 py-3 text-left text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Client</th>
                    <th className="px-6 py-3 text-left text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Type</th>
                    <th className="px-6 py-3 text-left text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Start</th>
                    <th className="px-6 py-3 text-left text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>End</th>
                    <th className="px-6 py-3 text-left text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Duration</th>
                    <th className="px-6 py-3 text-left text-sm uppercase tracking-wide" style={{ color: '#6B7280' }}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoadingEntries ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm" style={{ color: '#6B7280' }}>Loading weekly activity...</td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm" style={{ color: '#6B7280' }}>No entries found.</td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="transition duration-200 hover:bg-slate-50" style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td className="px-6 py-4 text-base font-medium" style={{ color: '#111827' }}>{formatDate(entry.start_time)}</td>
                        <td className="px-6 py-4 text-base font-medium" style={{ color: '#111827' }}>{clients.find((row) => row.id === entry.client_id)?.name || '—'}</td>
                        <td className="px-6 py-4 text-base font-medium" style={{ color: '#111827' }}>{entryLevel2Lookup[entry.level2_id]?.name || '—'}</td>
                        <td className="px-6 py-4 text-base font-medium" style={{ color: '#111827' }}>{formatTime(entry.start_time)}</td>
                        <td className="px-6 py-4 text-base font-medium" style={{ color: '#111827' }}>{entry.end_time ? formatTime(entry.end_time) : '—'}</td>
                        <td className="px-6 py-4 text-base font-semibold" style={{ color: '#111827' }}>{entry.hours ? `${entry.hours.toFixed(2)}h` : '—'}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium" style={entry.status === 'completed' ? { backgroundColor: '#DCFCE7', color: '#166534' } : { backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                            {entry.status === 'completed' ? 'Completed' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
