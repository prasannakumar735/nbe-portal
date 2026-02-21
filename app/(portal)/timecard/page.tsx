'use client'

import { useState, useEffect } from 'react'
import { 
  Play, 
  Square, 
  CheckCircle2, 
  Clock, 
  Briefcase, 
  MapPin, 
  FolderOpen, 
  FileText,
  Timer
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { 
  ClientService, 
  ClientLocationService, 
  TimeEntryService, 
  WorkTypeService 
} from '@/lib/services/timecard.service'
import type { 
  ActiveWorkEntry, 
  Client, 
  ClientLocation, 
  WorkTypeLevel1, 
  WorkTypeLevel2 
} from '@/lib/types/timecard.types'

export default function TimecardPage() {
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Data State
  const [clients, setClients] = useState<Client[]>([])
  const [locations, setLocations] = useState<ClientLocation[]>([])
  const [workTypesLevel1, setWorkTypesLevel1] = useState<WorkTypeLevel1[]>([])
  const [level2Options, setLevel2Options] = useState<WorkTypeLevel2[]>([])

  // Selection State
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedLevel1Id, setSelectedLevel1Id] = useState('')
  const [selectedLevel2Id, setSelectedLevel2Id] = useState('')
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<ClientLocation | null>(null)
  const [selectedLevel1, setSelectedLevel1] = useState<WorkTypeLevel1 | null>(null)
  const [selectedLevel2, setSelectedLevel2] = useState<WorkTypeLevel2 | null>(null)

  // Active Entry State
  const [activeEntry, setActiveEntry] = useState<ActiveWorkEntry | null>(null)
  const [elapsedTimeStr, setElapsedTimeStr] = useState('00:00:00')

  // UI State
  const [isWorking, setIsWorking] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize: Get User & Load Data
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return // Handle redirect?
        setCurrentUser(user)

        const [active, clientData, level1Data] = await Promise.all([
          TimeEntryService.getActiveEntry(user.id),
          ClientService.getAll(),
          supabase.from('work_type_level1').select('*').eq('active', true).order('name')
        ])

        // Transform level 1 data
        const transformedLevel1 = (level1Data.data || []).map(item => ({
          id: item.id,
          code: item.code,
          description: item.name,
          active: item.active
        }))

        setClients(clientData)
        setWorkTypesLevel1(transformedLevel1)

        if (active) {
          setActiveEntry(active)
          await loadActiveEntryDetails(active, clientData, transformedLevel1)
        }
      } catch (error) {
        console.error('Error initializing timecard:', error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (activeEntry) {
      const updateTimer = () => {
        const start = new Date(activeEntry.start_time).getTime()
        const now = new Date().getTime()
        const diff = now - start
        
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        
        setElapsedTimeStr(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        )
      }
      
      updateTimer() // Initial update
      interval = setInterval(updateTimer, 1000)
    } else {
      setElapsedTimeStr('00:00:00')
    }

    return () => clearInterval(interval)
  }, [activeEntry])

  const loadActiveEntryDetails = async (
    entry: ActiveWorkEntry, 
    currentClients: Client[], 
    currentLevel1: WorkTypeLevel1[]
  ) => {
    try {
      const client = currentClients.find(c => c.id === entry.client_id)
      const location = await ClientLocationService.getById(entry.location_id!)
      const level1 = currentLevel1.find(w => w.id === entry.level1_id)
      
      const { data: level2 } = await supabase
        .from('work_type_level2')
        .select('id, code, name, billable')
        .eq('id', entry.level2_id)
        .single()

      setSelectedClient(client || null)
      setSelectedLocation(location || null)
      setSelectedLevel1(level1 || null)
      
      if (level2) {
        setSelectedLevel2({
          id: level2.id,
          level1_id: entry.level1_id!,
          code: level2.code,
          description: level2.name,
          billable: level2.billable,
          is_leave_type: false,
          active: true
        })
      }
    } catch (error) {
      console.error('Error loading active entry details:', error)
    }
  }

  // Handle Changes
  const handleClientChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = e.target.value
    setSelectedClientId(clientId)
    setSelectedLocationId('')
    setSelectedLevel1Id('')
    setSelectedLevel2Id('')
    
    setSelectedClient(clients.find(c => c.id === clientId) || null)
    setSelectedLocation(null)
    setSelectedLevel1(null)
    setSelectedLevel2(null)
    setLocations([])

    if (clientId) {
      const locs = await ClientLocationService.getByClient(clientId)
      setLocations(locs)
    }
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locationId = e.target.value
    setSelectedLocationId(locationId)
    setSelectedLevel1Id('')
    setSelectedLevel2Id('')
    
    setSelectedLocation(locations.find(l => l.id === locationId) || null)
    setSelectedLevel1(null)
    setSelectedLevel2(null)
    setLevel2Options([])
  }

  const handleLevel1Change = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const level1Id = e.target.value
    setSelectedLevel1Id(level1Id)
    setSelectedLevel2Id('')
    
    setSelectedLevel1(workTypesLevel1.find(w => w.id === level1Id) || null)
    setSelectedLevel2(null)

    if (level1Id) {
      const level2s = await WorkTypeService.getLevel2ByLevel1(level1Id)
      setLevel2Options(level2s)
    }
  }

  const handleLevel2Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const level2Id = e.target.value
    setSelectedLevel2Id(level2Id)
    const level2 = level2Options.find(l => l.id === level2Id)
    setSelectedLevel2(level2 || null)
  }

  const canStart = selectedClientId && selectedLocationId && selectedLevel1Id && selectedLevel2Id

  const handleStartWork = async () => {
    if (!canStart || !currentUser) return

    setIsWorking(true)
    setErrors({})

    try {
      const billable = selectedLevel2?.billable ?? false

      const newEntry = await TimeEntryService.startWork({
        employee_id: currentUser.id,
        client_id: selectedClientId,
        location_id: selectedLocationId,
        level1_id: selectedLevel1Id,
        level2_id: selectedLevel2Id,
        billable,
        start_time: new Date().toISOString(),
        end_time: null,
        status: 'active',
        hours: 0
      })

      setActiveEntry(newEntry)
      // Reset form
      setSelectedClientId('')
      setSelectedLocationId('')
      setSelectedLevel1Id('')
      setSelectedLevel2Id('')
    } catch (error) {
      console.error('Error starting work:', error)
      setErrors({ general: 'Failed to start work. Please try again.' })
    } finally {
      setIsWorking(false)
    }
  }

  const handleEndWork = async () => {
    if (!activeEntry) return

    setIsWorking(true)
    try {
      await TimeEntryService.endWork(activeEntry.id, new Date(activeEntry.start_time))
      setActiveEntry(null)
      setElapsedTimeStr('00:00:00')
      
      // Reset selection display
      setSelectedClient(null)
      setSelectedLocation(null)
      setSelectedLevel1(null)
      setSelectedLevel2(null)
    } catch (error) {
      console.error('Error ending work:', error)
      setErrors({ general: 'Failed to stop work. Please try again.' })
    } finally {
      setIsWorking(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-50 h-full overflow-y-auto">
      {/* 1️⃣ Purple Hero Header Section */}
      <div className="bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#4338ca] text-white py-12 px-8 shadow-md relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

        <div className="max-w-[1600px] mx-auto relative z-10 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Timecard</h1>
            <p className="text-indigo-200 text-lg font-light tracking-wide">
              Track, log, and manage work hours across all projects
            </p>
          </div>
          
          {activeEntry && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-medium text-emerald-100 tracking-wide uppercase">Time Running</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-8 -mt-8 relative z-20">
        
        {/* 2️⃣ Active Session Card (Premium Style) */}
        {activeEntry ? (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-600 to-indigo-600"></div>
            
            <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: Timer & Status */}
              <div className="lg:col-span-4 space-y-4">
                <div className="flex items-center gap-3 text-purple-600 mb-1">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Timer className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold tracking-widest uppercase">Active Session</span>
                </div>
                
                <div>
                  <div className="text-7xl font-mono font-bold text-gray-900 tracking-tighter tabular-nums leading-none">
                    {elapsedTimeStr}
                  </div>
                  <div className="text-sm text-gray-400 font-medium mt-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Started at {new Date(activeEntry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Middle: Session Details Grid */}
              <div className="lg:col-span-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                  <div className="group">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 group-hover:text-purple-600 transition-colors">Client</div>
                    <div className="font-semibold text-gray-800 text-lg">{selectedClient?.name || 'Loading...'}</div>
                  </div>
                  <div className="group">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 group-hover:text-purple-600 transition-colors">Location</div>
                    <div className="font-semibold text-gray-800 text-lg flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {selectedLocation?.name || 'Loading...'}
                    </div>
                  </div>
                  <div className="group">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 group-hover:text-purple-600 transition-colors">Work Type</div>
                    <div className="font-semibold text-gray-800 text-lg">{selectedLevel1?.description || 'Loading...'}</div>
                  </div>
                  <div className="group">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1 group-hover:text-purple-600 transition-colors">Task</div>
                    <div className="font-semibold text-gray-800 text-lg">{selectedLevel2?.description || 'Loading...'}</div>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="lg:col-span-2 flex flex-col gap-3 justify-end items-end h-full border-l border-gray-100 pl-8">
                <button 
                  onClick={handleEndWork}
                  disabled={isWorking}
                  className="w-full py-3 px-6 bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-xl shadow-sm transition-all duration-200 font-semibold flex items-center justify-center gap-2 group disabled:opacity-70"
                >
                  <Square className="w-4 h-4 fill-current group-hover:fill-white transition-colors" />
                  {isWorking ? 'Stopping...' : 'Stop Work'}
                </button>
              </div>
            </div>
            
            {/* Progress Bar Loader (Visual flair) */}
            <div className="h-1 w-full bg-gray-50">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 w-1/3 animate-[pulse_3s_ease-in-out_infinite]"></div>
            </div>
          </div>
        ) : (
          /* 3️⃣ Work in Progress Section (New Entry) */
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
              <div className="bg-indigo-50 p-2.5 rounded-lg text-indigo-600">
                <Play className="w-5 h-5 fill-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Start New Session</h2>
                <p className="text-gray-500 text-sm">Select project details to begin tracking time</p>
              </div>
            </div>

            {errors.general && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex gap-2 items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                {errors.general}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5" /> Client
                  </label>
                  <div className="relative">
                    <select 
                      value={selectedClientId}
                      onChange={handleClientChange}
                      className="w-full pl-4 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer hover:bg-gray-100/50"
                    >
                      <option value="">Select Client...</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </label>
                  <div className="relative">
                    <select 
                      value={selectedLocationId}
                      onChange={handleLocationChange}
                      disabled={!selectedClientId}
                      className="w-full pl-4 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer hover:bg-gray-100/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Location...</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5" /> Work Type
                  </label>
                  <div className="relative">
                    <select 
                      value={selectedLevel1Id}
                      onChange={handleLevel1Change}
                      disabled={!selectedLocationId}
                      className="w-full pl-4 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer hover:bg-gray-100/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Work Type...</option>
                      {workTypesLevel1.map(w => (
                        <option key={w.id} value={w.id}>{w.description}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> Task
                  </label>
                  <div className="relative">
                    <select 
                      value={selectedLevel2Id}
                      onChange={handleLevel2Change}
                      disabled={!selectedLevel1Id}
                      className="w-full pl-4 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer hover:bg-gray-100/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Task...</option>
                      {level2Options.map(l => (
                        <option key={l.id} value={l.id}>{l.description}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-end">
              <button 
                onClick={handleStartWork}
                disabled={!canStart || isWorking}
                className="px-10 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-purple-500/30 font-bold text-lg tracking-wide transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isWorking ? 'Starting...' : 'Start Work'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
