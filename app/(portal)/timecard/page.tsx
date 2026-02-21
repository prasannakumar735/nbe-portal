'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TopNavigation } from '../components/TopNavigation'
import { 
  TimecardHero, 
  ActiveSessionCard, 
  TimecardSummaryCards, 
  TimeEntryForm, 
  WeeklyActivityTable, 
  WeekNavigation,
  BadgeStatus
} from './components'
import { AlertCircle, CheckCircle } from 'lucide-react'

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

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function TimecardPage() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  
  const [clients, setClients] = useState<Client[]>([])
  const [workTypesL1, setWorkTypesL1] = useState<WorkTypeLevel1[]>([])
  
  const [clientLookup, setClientLookup] = useState<Record<string, Client>>({})
  const [locationLookup, setLocationLookup] = useState<Record<string, ClientLocation>>({})
  const [level1Lookup, setLevel1Lookup] = useState<Record<string, WorkTypeLevel1>>({})
  const [level2Lookup, setLevel2Lookup] = useState<Record<string, WorkTypeLevel2>>({})

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    return weekStart
  })
  const [showBillableOnly, setShowBillableOnly] = useState(false)

  const clearMessages = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  // ==========================================
  // DATA LOADING
  // ==========================================

  const loadBaseOptions = useCallback(async () => {
    try {
      const [clientRes, l1Res] = await Promise.all([
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase.from('work_type_level1').select('id, code, name').order('code', { ascending: true })
      ])

      if (clientRes.error) throw clientRes.error
      if (l1Res.error) throw l1Res.error

      setClients(clientRes.data || [])
      setWorkTypesL1((l1Res.data || []).map(l => ({ ...l, code: l.code || '', name: l.name || '' })))

      const cMap: Record<string, Client> = {}
      ;(clientRes.data || []).forEach(c => cMap[c.id] = c)
      setClientLookup(cMap)

      const l1Map: Record<string, WorkTypeLevel1> = {}
      ;(l1Res.data || []).forEach(l => l1Map[l.id] = l)
      setLevel1Lookup(l1Map)

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load options')
    }
  }, [])

  const loadEntries = useCallback(async (userId: string) => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', userId)
        .order('start_time', { ascending: false })
        .limit(100)

      if (error) throw error

      const rows = (data || []) as TimeEntry[]
      setEntries(rows)

      const active = rows.find(e => e.status === 'active' && !e.end_time) || null
      setActiveEntry(active)

      const missingLocIds = new Set<string>()
      const missingL2Ids = new Set<string>()

      rows.forEach(r => {
        if (r.location_id && !locationLookup[r.location_id]) missingLocIds.add(r.location_id)
        if (r.level2_id && !level2Lookup[r.level2_id]) missingL2Ids.add(r.level2_id)
      })

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
      setErrorMessage('Failed to load history')
    }
  }, [locationLookup, level2Lookup])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        await loadBaseOptions()
        await loadEntries(user.id)
      } else {
        router.push('/')
      }
      setIsLoadingPage(false)
    }
    init()
  }, [router, loadBaseOptions, loadEntries])

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleClientChange = async (clientId: string) => {
    if (!clientId) return []
    
    try {
      const { data, error } = await supabase
        .from('client_locations')
        .select('id, client_id, suburb')
        .eq('client_id', clientId)

      if (error) throw error
      
      return (data || []).map(loc => ({
        id: loc.id,
        name: loc.suburb
      }))
    } catch (error) {
      return []
    }
  }

  const handleWorkTypeChange = async (level1Id: string) => {
    if (!level1Id) return []
    
    try {
      const { data, error } = await supabase
        .from('work_type_level2')
        .select('id, level1_id, code, name, billable')
        .eq('level1_id', level1Id)

      if (error) throw error
      
      return (data || []).map(task => ({
        id: task.id,
        name: task.name,
        code: task.code
      }))
    } catch (error) {
      return []
    }
  }

  const handleStartWork = async (formData: {
    clientId: string
    locationId: string
    workTypeLevel1Id: string
    workTypeLevel2Id: string
    description: string
    billable: boolean
  }) => {
    clearMessages()
    if (!user) return

    try {
      const payload = {
        employee_id: user.id,
        client_id: formData.clientId,
        location_id: formData.locationId,
        level1_id: formData.workTypeLevel1Id,
        level2_id: formData.workTypeLevel2Id,
        billable: formData.billable,
        start_time: new Date().toISOString(),
        status: 'active'
      }

      const { error } = await supabase
        .from('time_entries')
        .insert(payload)

      if (error) throw error

      setSuccessMessage('Work session started successfully')
      await loadEntries(user.id)

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to start work')
      throw error
    }
  }

  const handleStopWork = async () => {
    clearMessages()
    if (!activeEntry || !user) return

    try {
      const now = new Date()
      const start = new Date(activeEntry.start_time)
      const diffMs = now.getTime() - start.getTime()
      const hours = Math.max(0.01, parseFloat((diffMs / 3600000).toFixed(2)))

      const payload = {
        end_time: now.toISOString(),
        hours: hours,
        status: 'completed'
      }

      const { error } = await supabase
        .from('time_entries')
        .update(payload)
        .eq('id', activeEntry.id)

      if (error) throw error

      setSuccessMessage('Work session stopped successfully')
      await loadEntries(user.id)

    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to stop work')
    }
  }

  // ==========================================
  // COMPUTED DATA
  // ==========================================

  const summaryData = useMemo(() => {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const weekEntries = entries.filter(e => {
      const entryDate = new Date(e.start_time)
      return entryDate >= currentWeekStart && entryDate < weekEnd
    })

    const filteredEntries = showBillableOnly 
      ? weekEntries.filter(e => e.billable)
      : weekEntries

    const totalHours = filteredEntries.reduce((acc, curr) => acc + (curr.hours || 0), 0)
    const billableHours = filteredEntries.filter(e => e.billable).reduce((acc, curr) => acc + (curr.hours || 0), 0)

    return {
      entriesThisWeek: filteredEntries.length,
      totalHours,
      billableHours
    }
  }, [entries, currentWeekStart, showBillableOnly])

  const weeklyTableData = useMemo(() => {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    let filteredEntries = entries.filter(e => {
      const entryDate = new Date(e.start_time)
      return entryDate >= currentWeekStart && entryDate < weekEnd
    })

    if (showBillableOnly) {
      filteredEntries = filteredEntries.filter(e => e.billable)
    }

    return filteredEntries.map(entry => {
      const l1 = level1Lookup[entry.level1_id]
      const l2 = level2Lookup[entry.level2_id]
      
      return {
        id: entry.id,
        date: entry.start_time,
        client: clientLookup[entry.client_id]?.name || 'Unknown',
        workType: l1 ? `${l1.code} - ${l1.name}` : 'Unknown',
        task: l2 ? `${l2.code} - ${l2.name}` : 'Unknown',
        startTime: entry.start_time,
        endTime: entry.end_time,
        duration: entry.hours,
        status: (entry.status === 'active' ? 'active' : 'completed') as BadgeStatus
      }
    })
  }, [entries, clientLookup, level1Lookup, level2Lookup, currentWeekStart, showBillableOnly])

  const activeSessionData = useMemo(() => {
    if (!activeEntry) return null

    return {
      id: activeEntry.id,
      client: clientLookup[activeEntry.client_id]?.name || 'Unknown',
      location: locationLookup[activeEntry.location_id]?.suburb || 'Unknown',
      workType: level1Lookup[activeEntry.level1_id]?.name || 'Unknown',
      task: level2Lookup[activeEntry.level2_id]?.name || 'Unknown',
      startTime: activeEntry.start_time
    }
  }, [activeEntry, clientLookup, locationLookup, level1Lookup, level2Lookup])

  // ==========================================
  // WEEK NAVIGATION & EXPORT
  // ==========================================

  const handlePreviousWeek = () => {
    setCurrentWeekStart(prev => {
      const newWeek = new Date(prev)
      newWeek.setDate(newWeek.getDate() - 7)
      return newWeek
    })
  }

  const handleNextWeek = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayWeekStart = new Date(today)
    todayWeekStart.setDate(todayWeekStart.getDate() - todayWeekStart.getDay())
    
    if (currentWeekStart < todayWeekStart) {
      setCurrentWeekStart(prev => {
        const newWeek = new Date(prev)
        newWeek.setDate(newWeek.getDate() + 7)
        return newWeek
      })
    }
  }

  const handleExport = () => {
    const csvEscape = (val: any) => {
      const s = val === null || val === undefined ? '' : String(val)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }

    const headers = ['Date', 'Client', 'Work Type', 'Task', 'Start', 'End', 'Duration (hrs)', 'Status']
    const rows = weeklyTableData.map(entry => [
      new Date(entry.date).toLocaleDateString('en-AU'),
      entry.client,
      entry.workType,
      entry.task,
      new Date(entry.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true }),
      entry.endTime ? new Date(entry.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
      entry.duration?.toFixed(2) || '0.00',
      entry.status
    ])

    const csvContent = [
      headers.map(csvEscape).join(','),
      ...rows.map(row => row.map(csvEscape).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timecard-${currentWeekStart.toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // ==========================================
  // RENDER
  // ==========================================

  if (isLoadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <TopNavigation user={user} />
      
      <TimecardHero isActiveSession={!!activeEntry} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Alerts */}
        {(errorMessage || successMessage) && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
            {errorMessage && (
              <div className="rounded-lg border px-4 py-3 flex items-center gap-3 bg-red-50 border-red-200 text-red-700 shadow-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="rounded-lg border px-4 py-3 flex items-center gap-3 bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{successMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Active Session Card */}
        {activeSessionData && (
          <ActiveSessionCard
            session={activeSessionData}
            onStop={handleStopWork}
            onComplete={handleStopWork}
          />
        )}

        {/* Summary Cards */}
        <TimecardSummaryCards data={summaryData} />

        {/* Week Navigation */}
        <WeekNavigation
          currentWeekStart={currentWeekStart}
          onPreviousWeek={handlePreviousWeek}
          onNextWeek={handleNextWeek}
          onExport={handleExport}
          showBillableOnly={showBillableOnly}
          onToggleBillable={setShowBillableOnly}
        />

        {/* Work Entry Form */}
        <TimeEntryForm
          clients={clients.map(c => ({ id: c.id, name: c.name }))}
          workTypes={workTypesL1}
          isDisabled={!!activeEntry}
          onSubmit={handleStartWork}
          onClientChange={handleClientChange}
          onWorkTypeChange={handleWorkTypeChange}
        />

        {/* Weekly Activity Table */}
        <WeeklyActivityTable 
          entries={weeklyTableData} 
          isLoading={false}
        />

      </main>
    </div>
  )
}

