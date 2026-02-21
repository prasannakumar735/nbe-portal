'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TopNavigation } from '../components/TopNavigation'
import {
  AlertCircle,
  CheckCircle
} from 'lucide-react'

// ==========================================
// TYPES
// ==========================================

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
  suburb: string // Used for display
}

interface WorkTypeLevel1 {
  id: string
  code: string
  name: string // Used for display
}

interface WorkTypeLevel2 {
  id: string
  level1_id: string
  code: string
  name: string
  billable: boolean
}

// ==========================================
// COMPONENT
// ==========================================

export default function TimeCardPage() {
  const router = useRouter()

  // -- State: User --
  const [user, setUser] = useState<any>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(true)

  // -- State: Data --
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  
  // -- State: Dropdown Options --
  const [clients, setClients] = useState<Client[]>([])
  const [locations, setLocations] = useState<ClientLocation[]>([])
  const [workTypesL1, setWorkTypesL1] = useState<WorkTypeLevel1[]>([])
  const [workTypesL2, setWorkTypesL2] = useState<WorkTypeLevel2[]>([])

  // -- State: Lookups for Display --
  const [clientLookup, setClientLookup] = useState<Record<string, Client>>({})
  const [locationLookup, setLocationLookup] = useState<Record<string, ClientLocation>>({})
  const [level1Lookup, setLevel1Lookup] = useState<Record<string, WorkTypeLevel1>>({})
  const [level2Lookup, setLevel2Lookup] = useState<Record<string, WorkTypeLevel2>>({})

  // -- State: Form Selection --
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedLevel1, setSelectedLevel1] = useState('')
  const [selectedLevel2, setSelectedLevel2] = useState('')

  // -- State: UI/Feedback --
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')

  // -- Helpers --
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

  const clearMessages = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  // -- Load Initial Data --
  const loadBaseOptions = useCallback(async () => {
    try {
      console.log('[Timecard] Loading base options...')
      
      const [clientRes, l1Res] = await Promise.all([
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase.from('work_type_level1').select('id, code, name').order('code', { ascending: true })
      ])

      if (clientRes.error) throw clientRes.error
      if (l1Res.error) throw l1Res.error

      setClients(clientRes.data || [])
      setWorkTypesL1(l1Res.data || [])

      // Build lookups
      const cMap: Record<string, Client> = {}
      ;(clientRes.data || []).forEach(c => cMap[c.id] = c)
      setClientLookup(cMap)

      const l1Map: Record<string, WorkTypeLevel1> = {}
      ;(l1Res.data || []).forEach(l => l1Map[l.id] = l)
      setLevel1Lookup(l1Map)

    } catch (error: any) {
      console.error('[Timecard] loadBaseOptions failed:', error)
      setErrorMessage(error.message || 'Failed to load options')
    }
  }, [])

  // -- Load Dependent Locations --
  const loadLocations = useCallback(async (clientId: string) => {
    if (!clientId) {
      setLocations([])
      return
    }
    try {
      const { data, error } = await supabase
        .from('client_locations')
        .select('id, client_id, suburb')
        .eq('client_id', clientId)

      if (error) throw error
      setLocations(data || [])
    } catch (error: any) {
      console.error('[Timecard] loadLocations failed:', error)
      setErrorMessage('Failed to load locations')
    }
  }, [])

  // -- Load Dependent Tasks (Level 2) --
  const loadTasks = useCallback(async (level1Id: string) => {
    if (!level1Id) {
      setWorkTypesL2([])
      return
    }
    try {
      const { data, error } = await supabase
        .from('work_type_level2')
        .select('id, level1_id, code, name, billable')
        .eq('level1_id', level1Id)

      if (error) throw error
      setWorkTypesL2(data || [])
    } catch (error: any) {
      console.error('[Timecard] loadTasks failed:', error)
      setErrorMessage('Failed to load tasks')
    }
  }, [])

  // -- Load Entries & Build Lookups --
  const loadEntries = useCallback(async (userId: string) => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', userId)
        .order('start_time', { ascending: false })

      if (error) throw error

      const rows = (data || []) as TimeEntry[]
      setEntries(rows)

      // Find active entry
      const active = rows.find(e => e.status === 'active' && !e.end_time) || null
      setActiveEntry(active)

      // Collect IDs for missing lookups
      const missingLocIds = new Set<string>()
      const missingL2Ids = new Set<string>()

      rows.forEach(r => {
        if (r.location_id && !locationLookup[r.location_id]) missingLocIds.add(r.location_id)
        if (r.level2_id && !level2Lookup[r.level2_id]) missingL2Ids.add(r.level2_id)
      })

      // Fetch missing lookups
      if (missingLocIds.size > 0) {
        const { data: locs } = await supabase
          .from('client_locations')
          .select('id, client_id, suburb')
          .in('id', Array.from(missingLocIds))
        
        if (locs) {
          setLocationLookup(prev => {
            const next = { ...prev }
            locs.forEach(l => next[l.id] = l)
            return next
          })
        }
      }

      if (missingL2Ids.size > 0) {
        const { data: l2s } = await supabase
          .from('work_type_level2')
          .select('id, level1_id, code, name, billable')
          .in('id', Array.from(missingL2Ids))

        if (l2s) {
          setLevel2Lookup(prev => {
            const next = { ...prev }
            l2s.forEach(l => next[l.id] = l)
            return next
          })
        }
      }

    } catch (error: any) {
      console.error('[Timecard] loadEntries failed:', error)
      setErrorMessage('Failed to load history')
    }
  }, [locationLookup, level2Lookup]) // Depend on lookups to avoid re-fetching known ones? Ideally not, but simple logic for now

  // -- Initial Load --
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        setUser(data.user)
        await loadBaseOptions()
        await loadEntries(data.user.id)
      } else {
        router.push('/')
      }
      setIsLoadingPage(false)
    }
    init()
  }, [router, loadBaseOptions]) // removed loadEntries from deps to avoid loop if not careful

  // -- Timer Effect --
  useEffect(() => {
    if (!activeEntry) {
      setElapsedTime('00:00:00')
      return
    }

    const interval = setInterval(() => {
      const start = new Date(activeEntry.start_time).getTime()
      const now = Date.now()
      const diff = Math.max(0, now - start)
      
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)

      setElapsedTime(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [activeEntry])

  // -- Handlers --

  const handleClientChange = (id: string) => {
    setSelectedClient(id)
    setSelectedLocation('')
    setLocations([])
    if (id) loadLocations(id)
  }

  const handleLevel1Change = (id: string) => {
    setSelectedLevel1(id)
    setSelectedLevel2('')
    setWorkTypesL2([])
    if (id) loadTasks(id)
  }

  const handleStartWork = async () => {
    clearMessages()
    if (!user) return

    if (!selectedClient || !selectedLocation || !selectedLevel1 || !selectedLevel2) {
      setErrorMessage('Please fill in all fields.')
      return
    }

    setIsSubmitting(true)
    try {
      // Get billable status from Level 2
      const l2 = workTypesL2.find(x => x.id === selectedLevel2)
      const billable = l2?.billable ?? true

      const payload = {
        employee_id: user.id,
        client_id: selectedClient,
        location_id: selectedLocation,
        level1_id: selectedLevel1,
        level2_id: selectedLevel2,
        billable: billable,
        start_time: new Date().toISOString(),
        status: 'active'
      }

      console.log('[Timecard] Starting work:', payload)

      const { error } = await supabase
        .from('time_entries')
        .insert(payload)

      if (error) throw error

      setSuccessMessage('Work started successfully')
      
       // Reset form
      setSelectedClient('')
      setSelectedLocation('')
      setSelectedLevel1('')
      setSelectedLevel2('')
      setLocations([])
      setWorkTypesL2([])

      await loadEntries(user.id)

    } catch (error: any) {
      console.error('[Timecard] Start failed:', error)
      setErrorMessage(error.message || 'Failed to start work')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStopWork = async () => {
    clearMessages()
    if (!activeEntry) return

    setIsSubmitting(true)
    try {
      const now = new Date()
      const start = new Date(activeEntry.start_time)
      const diffMs = now.getTime() - start.getTime()
      const hours = parseFloat((diffMs / 3600000).toFixed(2))

      const payload = {
        end_time: now.toISOString(),
        hours: hours,
        status: 'completed'
      }

      console.log('[Timecard] Stopping work:', payload)

      const { error } = await supabase
        .from('time_entries')
        .update(payload)
        .eq('id', activeEntry.id)

      if (error) throw error

      setSuccessMessage('Work stopped successfully')
      await loadEntries(user.id)

    } catch (error: any) {
      console.error('[Timecard] Stop failed:', error)
      setErrorMessage(error.message || 'Failed to stop work')
    } finally {
      setIsSubmitting(false)
    }
  }

  // -- Computed --
  const weeklyTotal = useMemo(() => {
    return entries.reduce((acc, curr) => acc + (curr.hours || 0), 0)
  }, [entries])

  if (isLoadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4338CA]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#0F172A]">
      <TopNavigation user={user} />

      {/* Hero Section */}
      <section className="bg-[#1E1B4B] border-b border-[#312E81]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Timecard & GPS Tracking
              </h1>
              <p className="text-base text-[#94A3B8]">
                Structured employee time tracking for internal operations and reporting.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium bg-[#DCFCE7] text-[#15803D] border border-[#bbf7d0]">
              <span className={`w-2 h-2 rounded-full bg-[#16A34A] ${activeEntry ? 'animate-pulse' : ''}`} />
              <span>
                {activeEntry ? 'Time Running' : 'Ready to Track'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 animate-fade-in">
        {/* Alerts */}
        {(errorMessage || successMessage) && (
          <div className="space-y-2">
            {errorMessage && (
              <div className="rounded-lg border px-4 py-3 flex items-center gap-3 bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="rounded-lg border px-4 py-3 flex items-center gap-3 bg-[#ECFDF5] border-[#A7F3D0] text-[#16A34A]">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{successMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Active Session Card */}
        {activeEntry && (
          <section>
            <div className="relative bg-white rounded-lg shadow-md border border-[#E5E7EB] overflow-hidden">
              {/* 8px left accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#5B21B6]" />

              <div className="p-6 lg:p-8 pl-8 lg:pl-10">
                <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
                  
                  {/* Left section */}
                  <div className="flex-shrink-0 space-y-2 text-center lg:text-left">
                    <div className="text-xs uppercase tracking-wider font-semibold text-[#5B21B6]">
                      Active Session
                    </div>
                    <div className="text-4xl lg:text-5xl font-bold font-mono text-[#0F172A] tracking-tight">
                      {elapsedTime}
                    </div>
                    <div className="text-sm text-[#94A3B8]">
                      Started at {formatTime(activeEntry.start_time)}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden lg:block w-px h-24 bg-[#F1F5F9]" />

                  {/* Center: 2-column info grid */}
                  <div className="flex-grow grid grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-[#94A3B8] mb-1">Client</div>
                      <div className="text-base font-medium text-[#0F172A]">{clientLookup[activeEntry.client_id]?.name || 'Unknown'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-[#94A3B8] mb-1">Location</div>
                      <div className="text-base font-medium text-[#0F172A]">{locationLookup[activeEntry.location_id]?.suburb || 'Unknown'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-[#94A3B8] mb-1">Work Type</div>
                      <div className="text-base font-medium text-[#0F172A]">{level1Lookup[activeEntry.level1_id]?.name || 'Unknown'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-[#94A3B8] mb-1">Task</div>
                      <div className="text-base font-medium text-[#0F172A]">{level2Lookup[activeEntry.level2_id]?.name || 'Unknown'}</div>
                    </div>
                  </div>

                  {/* Right: Primary action area */}
                  <div className="flex-shrink-0 flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-48">
                    <button
                      onClick={handleStopWork}
                      disabled={isSubmitting}
                      className="w-full h-11 rounded-md bg-[#DC2626] hover:bg-[#B91C1C] text-white font-medium shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-[1px] disabled:opacity-70 disabled:hover:translate-y-0"
                    >
                      Stop Work
                    </button>
                    <button
                      onClick={handleStopWork}
                      disabled={isSubmitting}
                      className="w-full h-11 rounded-md bg-transparent border border-[#E5E7EB] text-[#475569] hover:bg-[#F8FAFC] font-medium transition-all duration-200 ease-in-out hover:-translate-y-[1px] disabled:opacity-70 disabled:hover:translate-y-0"
                    >
                      Complete
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </section>
        )}

        {/* Work Entry Section */}
        <section className={`transition-all duration-200 ${activeEntry ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-6 lg:p-8">
            <h2 className="text-xl font-semibold text-[#0F172A] mb-6">Work Entry</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-[#94A3B8]">Client</label>
                <select
                  className="block w-full h-11 rounded-md border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/20 focus:border-[#5B21B6] transition-all duration-200"
                  value={selectedClient}
                  onChange={(e) => handleClientChange(e.target.value)}
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-[#94A3B8]">Location</label>
                <select
                  className="block w-full h-11 rounded-md border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/20 focus:border-[#5B21B6] transition-all duration-200 disabled:opacity-50 disabled:bg-[#F8FAFC]"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  disabled={!selectedClient}
                >
                  <option value="">Select location...</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.suburb}</option>
                  ))}
                </select>
              </div>

              {/* Level 1 */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-[#94A3B8]">Work Type</label>
                <select
                  className="block w-full h-11 rounded-md border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/20 focus:border-[#5B21B6] transition-all duration-200"
                  value={selectedLevel1}
                  onChange={(e) => handleLevel1Change(e.target.value)}
                >
                  <option value="">Select work type...</option>
                  {workTypesL1.map(w => (
                    <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                  ))}
                </select>
              </div>

              {/* Level 2 */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-[#94A3B8]">Task</label>
                <select
                  className="block w-full h-11 rounded-md border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/20 focus:border-[#5B21B6] transition-all duration-200 disabled:opacity-50 disabled:bg-[#F8FAFC]"
                  value={selectedLevel2}
                  onChange={(e) => setSelectedLevel2(e.target.value)}
                  disabled={!selectedLevel1}
                >
                  <option value="">Select task...</option>
                  {workTypesL2.map(w => (
                    <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {!activeEntry && (
              <div className="mt-8">
                <button
                  onClick={handleStartWork}
                  disabled={isSubmitting}
                  className="w-full md:w-auto h-11 px-8 rounded-md bg-[#5B21B6] hover:bg-[#4338CA] text-white font-medium shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-[1px] disabled:opacity-70 disabled:hover:translate-y-0"
                >
                  {isSubmitting ? 'Starting...' : 'Start Work'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Weekly Table */}
        <section>
          <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="px-6 py-5 border-b border-[#E5E7EB] bg-white flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#0F172A]">Weekly Activity</h2>
              <div className="text-sm text-[#475569]">
                Total Hours: <span className="font-semibold text-[#0F172A]">{weeklyTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left border-collapse">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider text-[#94A3B8] font-medium">Date</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider text-[#94A3B8] font-medium">Client</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider text-[#94A3B8] font-medium">Work Type</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider text-[#94A3B8] font-medium">Start</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider text-[#94A3B8] font-medium">End</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider text-[#94A3B8] font-medium">Duration</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider text-[#94A3B8] font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-[#94A3B8]">
                        No activity recorded yet.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-[#F1F5F9] transition-colors duration-150">
                        <td className="px-6 py-4 text-sm font-medium text-[#0F172A]">
                          {formatDate(entry.start_time)}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#475569]">
                          {clientLookup[entry.client_id]?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-[#0F172A]">{level1Lookup[entry.level1_id]?.name || 'Unknown'}</div>
                          <div className="text-xs text-[#94A3B8] mt-0.5">{level2Lookup[entry.level2_id]?.name || 'Unknown'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#475569]">{formatTime(entry.start_time)}</td>
                        <td className="px-6 py-4 text-sm text-[#475569]">{entry.end_time ? formatTime(entry.end_time) : '—'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-[#0F172A]">{entry.hours ? `${entry.hours.toFixed(2)}h` : '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            entry.status === 'completed' 
                              ? 'bg-[#F1F5F9] text-[#475569]' 
                              : 'bg-[#DCFCE7] text-[#15803D]'
                          }`}>
                            {entry.status === 'completed' ? 'Completed' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
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

