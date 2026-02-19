'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, Play, Square, Clock, X } from 'lucide-react'
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

interface TimeEntryStartFormProps {
  user?: { id?: string } | null
  onSuccess?: () => void
}

export default function TimeEntryStartForm({ user, onSuccess }: TimeEntryStartFormProps) {
  const userId = user?.id
  const [clients, setClients] = useState<Client[]>([])
  const [locations, setLocations] = useState<ClientLocation[]>([])
  const [workTypesLevel1, setWorkTypesLevel1] = useState<WorkTypeLevel1[]>([])
  const [level2Options, setLevel2Options] = useState<WorkTypeLevel2[]>([])

  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedLevel1Id, setSelectedLevel1Id] = useState('')
  const [selectedLevel2Id, setSelectedLevel2Id] = useState('')
  const [selectedLevel2, setSelectedLevel2] = useState<WorkTypeLevel2 | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<ClientLocation | null>(null)
  const [selectedLevel1, setSelectedLevel1] = useState<WorkTypeLevel1 | null>(null)

  const [activeEntry, setActiveEntry] = useState<ActiveWorkEntry | null>(null)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [showWorkSelection, setShowWorkSelection] = useState(false)

  // Timer effect
  useEffect(() => {
    if (!activeEntry) return

    const updateTimer = () => {
      const startTime = new Date(activeEntry.start_time).getTime()
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      
      const hours = Math.floor(elapsed / 3600)
      const minutes = Math.floor((elapsed % 3600) / 60)
      const seconds = elapsed % 60

      setElapsedTime(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      )
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [activeEntry])

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const clientData = await ClientService.getAll()

        const { data: level1, error: level1Error } = await supabase
          .from('work_type_level1')
          .select('id, code, name')
          .order('code')
        
        if (level1Error) throw level1Error

        const transformedLevel1 = (level1 || []).map(l1 => ({
          id: l1.id,
          code: l1.code,
          description: l1.name
        }))

        const { data: active, error: activeError } = await supabase
          .from('time_entries')
          .select('*')
          .eq('employee_id', userId)
          .eq('status', 'active')
          .is('end_time', null)
          .maybeSingle()
        
        if (activeError) throw activeError

        setClients(clientData)
        setWorkTypesLevel1(transformedLevel1)

        if (active) {
          setActiveEntry(active)
          await loadActiveEntryDetails(active)
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error loading initial data:', error)
        setIsLoading(false)
      }
    }

    if (userId) {
      loadInitialData()
    }
  }, [userId])

  const loadActiveEntryDetails = async (entry: ActiveWorkEntry) => {
    try {
      const client = clients.find(c => c.id === entry.client_id)
      const locations = await ClientLocationService.getByClient(entry.client_id)
      const location = locations.find(l => l.id === entry.location_id)
      const level1 = workTypesLevel1.find(w => w.id === entry.work_type_level1_id)
      
      const { data: level2 } = await supabase
        .from('work_type_level2')
        .select('id, code, name, billable')
        .eq('id', entry.work_type_level2_id)
        .single()

      setSelectedClient(client || null)
      setSelectedLocation(location || null)
      setSelectedLevel1(level1 || null)
      if (level2) {
        setSelectedLevel2({
          id: level2.id,
          level1_id: entry.work_type_level1_id,
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

  const handleClientChange = async (clientId: string) => {
    setSelectedClientId(clientId)
    setSelectedLocationId('')
    setSelectedLevel1Id('')
    setSelectedLevel2Id('')
    setSelectedClient(clients.find(c => c.id === clientId) || null)
    setSelectedLocation(null)
    setSelectedLevel1(null)
    setSelectedLevel2(null)

    if (clientId) {
      const locs = await ClientLocationService.getByClient(clientId)
      setLocations(locs)
    }
  }

  const handleLocationChange = async (locationId: string) => {
    setSelectedLocationId(locationId)
    setSelectedLevel1Id('')
    setSelectedLevel2Id('')
    setSelectedLocation(locations.find(l => l.id === locationId) || null)
    setSelectedLevel1(null)
    setSelectedLevel2(null)
    setLevel2Options([])
  }

  const handleLevel1Change = async (level1Id: string) => {
    setSelectedLevel1Id(level1Id)
    setSelectedLevel2Id('')
    setSelectedLevel1(workTypesLevel1.find(w => w.id === level1Id) || null)
    setSelectedLevel2(null)

    if (level1Id) {
      const level2s = await WorkTypeService.getLevel2ByLevel1(level1Id)
      setLevel2Options(level2s)
    }
  }

  const handleLevel2Change = (level2Id: string) => {
    setSelectedLevel2Id(level2Id)
    const level2 = level2Options.find(l => l.id === level2Id)
    setSelectedLevel2(level2 || null)
  }

  const canStart = selectedClientId && selectedLocationId && selectedLevel1Id && selectedLevel2Id

  const handleStartWork = async () => {
    if (!canStart) return
    if (!selectedLevel1Id || !selectedLevel2Id) {
      setErrors({ general: 'Please select all required fields' })
      return
    }

    setIsWorking(true)
    setErrors({})

    try {
      const billable = selectedLevel2?.billable ?? false

      const newEntry = await TimeEntryService.startWork({
        employee_id: userId!,
        client_id: selectedClientId,
        location_id: selectedLocationId,
        level1_id: selectedLevel1Id,
        level2_id: selectedLevel2Id,
        billable
      })

      setActiveEntry(newEntry)
      setSelectedClientId('')
      setSelectedLocationId('')
      setSelectedLevel1Id('')
      setSelectedLevel2Id('')
      setShowWorkSelection(false)
      setSuccessMessage('Work entry started successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      onSuccess?.()
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
    setErrors({})

    try {
      const startTime = new Date(activeEntry.start_time).getTime()
      const endTime = Date.now()
      const durationMs = endTime - startTime
      const hours = durationMs / (1000 * 60 * 60)

      await TimeEntryService.endWork(activeEntry.id, activeEntry.start_time)

      setActiveEntry(null)
      setElapsedTime('00:00:00')
      setSuccessMessage('Work entry completed successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      onSuccess?.()
    } catch (error) {
      console.error('Error ending work:', error)
      setErrors({ general: 'Failed to complete work. Please try again.' })
    } finally {
      setIsWorking(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white border border-gray-200 rounded-2xl">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-300 border-t-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Messages */}
      {errors.general && (
        <div className="flex items-start gap-3 p-4 bg-red-50/80 border border-red-100 rounded-xl">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">{errors.general}</p>
          </div>
          <button
            onClick={() => setErrors({})}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50/80 border border-emerald-100 rounded-xl">
          <Check size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="font-semibold text-emerald-900">{successMessage}</p>
        </div>
      )}

      {/* PREMIUM LIVE TIME TRACKER CARD */}
      <div
        className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all duration-300 ${
          activeEntry
            ? 'border-purple-200 ring-1 ring-purple-100/50 shadow-lg'
            : 'border-gray-200 shadow-sm'
        }`}
      >
        {activeEntry ? (
          // ACTIVE STATE - Professional Time Tracker Display
          <div className="p-8">
            {/* Header with Status Indicator */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="animate-pulse flex h-3 w-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                <span className="text-sm font-semibold text-slate-700">Active Work Session</span>
              </div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {new Date(activeEntry.start_time).toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>

            {/* Main Grid - Left Info / Right Timer */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Left Side - Work Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Client */}
                <div className="border-b border-gray-100 pb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Client</p>
                  <p className="text-xl font-bold text-slate-900">
                    {selectedClient?.client_name || selectedClient?.name || 'Unknown Client'}
                  </p>
                </div>

                {/* Location */}
                <div className="border-b border-gray-100 pb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Location</p>
                  <p className="text-lg font-semibold text-slate-700">
                    {selectedLocation?.suburb || 'Unknown Location'}
                  </p>
                </div>

                {/* Work Types */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Work Type</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {selectedLevel1?.code}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedLevel1?.description}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Task</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {selectedLevel2?.code}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedLevel2?.description}
                    </p>
                  </div>
                </div>

                {/* Start Time */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Started</p>
                  <p className="text-sm font-mono text-slate-600">
                    {new Date(activeEntry.start_time).toLocaleTimeString('en-AU', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </p>
                </div>
              </div>

              {/* Right Side - Timer & Actions */}
              <div className="lg:col-span-1">
                {/* Large Timer Display */}
                <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50 border border-purple-100/50 rounded-2xl p-6 mb-6 text-center">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                    Elapsed Time
                  </p>
                  <p className="text-5xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-700 tracking-tight">
                    {elapsedTime}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">hours : minutes : seconds</p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 flex flex-col">
                  <button
                    onClick={handleEndWork}
                    disabled={isWorking}
                    className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-red-500/30 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2 transform hover:scale-105"
                  >
                    {isWorking ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Stopping...</span>
                      </>
                    ) : (
                      <>
                        <Square size={20} />
                        <span>Stop Work</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowWorkSelection(true)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95 flex items-center justify-center gap-2 transform hover:scale-105"
                  >
                    <Check size={20} />
                    <span>Complete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // IDLE STATE - Work Selection Panel
          <div className="p-8">
            {!showWorkSelection ? (
              <div className="text-center py-8">
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 mb-6">
                  <Clock className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">No Active Work</h3>
                  <p className="text-sm text-slate-600 mb-6">
                    Start tracking your time by selecting your work details
                  </p>
                  <button
                    onClick={() => setShowWorkSelection(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 transform hover:scale-105"
                  >
                    <Play size={20} />
                    <span>Start Work</span>
                  </button>
                </div>
              </div>
            ) : (
              // Work Selection Grid
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Select Work Details</h3>
                  <button
                    onClick={() => setShowWorkSelection(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  {/* Client Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Client <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => handleClientChange(e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all ${
                        errors.client_id ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                    >
                      <option value="">Select Client...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.client_name || client.name || client.code || client.id}
                        </option>
                      ))}
                    </select>
                    {errors.client_id && <p className="mt-1 text-xs text-red-600">{errors.client_id}</p>}
                  </div>

                  {/* Location Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedLocationId}
                      onChange={(e) => handleLocationChange(e.target.value)}
                      disabled={!selectedClientId}
                      className={`w-full px-4 py-3 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        errors.location_id ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                    >
                      <option value="">Select Location...</option>
                      {locations.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.suburb}
                        </option>
                      ))}
                    </select>
                    {errors.location_id && <p className="mt-1 text-xs text-red-600">{errors.location_id}</p>}
                  </div>

                  {/* Level 1 Work Type */}
                  {selectedLocationId && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Work Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedLevel1Id}
                        onChange={(e) => handleLevel1Change(e.target.value)}
                        className={`w-full px-4 py-3 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all ${
                          errors.work_type_level1_id ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <option value="">Select Work Type...</option>
                        {workTypesLevel1.map(wt => (
                          <option key={wt.id} value={wt.id}>
                            {wt.code} - {wt.description}
                          </option>
                        ))}
                      </select>
                      {errors.work_type_level1_id && <p className="mt-1 text-xs text-red-600">{errors.work_type_level1_id}</p>}
                    </div>
                  )}

                  {/* Level 2 Work Type */}
                  {selectedLevel1Id && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Task <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedLevel2Id}
                        onChange={(e) => handleLevel2Change(e.target.value)}
                        className={`w-full px-4 py-3 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 outline-none transition-all ${
                          errors.work_type_level2_id ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <option value="">Select Task...</option>
                        {level2Options.map(l2 => (
                          <option key={l2.id} value={l2.id}>
                            {l2.code} - {l2.description}
                          </option>
                        ))}
                      </select>
                      {errors.work_type_level2_id && <p className="mt-1 text-xs text-red-600">{errors.work_type_level2_id}</p>}
                    </div>
                  )}
                </div>

                {/* Start Work Button */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowWorkSelection(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-slate-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartWork}
                    disabled={!canStart || isWorking}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-purple-400 disabled:to-purple-400 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2 transform hover:scale-105"
                  >
                    {isWorking ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Starting...</span>
                      </>
                    ) : (
                      <>
                        <Play size={20} />
                        <span>Start Work</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
