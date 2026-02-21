'use client'

import { useState, useEffect } from 'react'
import { Play } from 'lucide-react'

interface DropdownOption {
  id: string
  name: string
  code?: string
}

interface TimeEntryFormProps {
  clients: DropdownOption[]
  workTypes: DropdownOption[]
  isDisabled?: boolean
  onSubmit: (data: {
    clientId: string
    locationId: string
    workTypeLevel1Id: string
    workTypeLevel2Id: string
    description: string
    billable: boolean
  }) => Promise<void>
  onClientChange: (clientId: string) => Promise<DropdownOption[]>
  onWorkTypeChange: (workTypeId: string) => Promise<DropdownOption[]>
}

export function TimeEntryForm({
  clients,
  workTypes,
  isDisabled = false,
  onSubmit,
  onClientChange,
  onWorkTypeChange
}: TimeEntryFormProps) {
  const [locations, setLocations] = useState<DropdownOption[]>([])
  const [tasks, setTasks] = useState<DropdownOption[]>([])
  
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedWorkType, setSelectedWorkType] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const [description, setDescription] = useState('')
  const [billable, setBillable] = useState(true)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (selectedClient) {
      onClientChange(selectedClient).then(setLocations)
    } else {
      setLocations([])
      setSelectedLocation('')
    }
  }, [selectedClient, onClientChange])

  useEffect(() => {
    if (selectedWorkType) {
      onWorkTypeChange(selectedWorkType).then(setTasks)
    } else {
      setTasks([])
      setSelectedTask('')
    }
  }, [selectedWorkType, onWorkTypeChange])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!selectedClient) newErrors.client = 'Client is required'
    if (!selectedLocation) newErrors.location = 'Location is required'
    if (!selectedWorkType) newErrors.workType = 'Work type is required'
    if (!selectedTask) newErrors.task = 'Task is required'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        clientId: selectedClient,
        locationId: selectedLocation,
        workTypeLevel1Id: selectedWorkType,
        workTypeLevel2Id: selectedTask,
        description,
        billable
      })
      
      // Reset form
      setSelectedClient('')
      setSelectedLocation('')
      setSelectedWorkType('')
      setSelectedTask('')
      setDescription('')
      setBillable(true)
      setErrors({})
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all duration-200 ${
      isDisabled ? 'opacity-50 pointer-events-none' : ''
    }`}>
      <h2 className="text-xl font-semibold text-slate-900 mb-6">Work Entry</h2>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className={`block w-full h-11 rounded-lg border px-3 text-sm bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                errors.client ? 'border-red-300' : 'border-slate-300'
              }`}
            >
              <option value="">Select a client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.client && <p className="mt-1 text-xs text-red-600">{errors.client}</p>}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Location <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              disabled={!selectedClient}
              className={`block w-full h-11 rounded-lg border px-3 text-sm bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 ${
                errors.location ? 'border-red-300' : 'border-slate-300'
              }`}
            >
              <option value="">Select location...</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location}</p>}
          </div>

          {/* Work Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Work Type <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedWorkType}
              onChange={(e) => setSelectedWorkType(e.target.value)}
              className={`block w-full h-11 rounded-lg border px-3 text-sm bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                errors.workType ? 'border-red-300' : 'border-slate-300'
              }`}
            >
              <option value="">Select work type...</option>
              {workTypes.map(w => (
                <option key={w.id} value={w.id}>
                  {w.code ? `${w.code} - ${w.name}` : w.name}
                </option>
              ))}
            </select>
            {errors.workType && <p className="mt-1 text-xs text-red-600">{errors.workType}</p>}
          </div>

          {/* Task */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Task <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              disabled={!selectedWorkType}
              className={`block w-full h-11 rounded-lg border px-3 text-sm bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 ${
                errors.task ? 'border-red-300' : 'border-slate-300'
              }`}
            >
              <option value="">Select task...</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.code ? `${t.code} - ${t.name}` : t.name}
                </option>
              ))}
            </select>
            {errors.task && <p className="mt-1 text-xs text-red-600">{errors.task}</p>}
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional notes about this work session..."
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Billable Toggle */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700">Billable Work</span>
            </label>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || isDisabled}
            className="h-11 px-8 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play size={18} />
                Start Work
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
