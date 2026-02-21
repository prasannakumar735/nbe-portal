'use client'

import { useState, useEffect } from 'react'
import { Plus, Save, X, AlertCircle, Check } from 'lucide-react'
import { WorkTypeService, ProjectService, TimeEntryService } from '@/lib/services/timecard.service'
import type { WorkTypeLevel1, WorkTypeLevel2, Project, TimeEntryFormData } from '@/lib/types/timecard.types'

interface TimeEntryFormProps {
  userId: string
  initialDate?: string
  onSuccess?: () => void
  onCancel?: () => void
  editingEntry?: any
}

export default function TimeEntryForm({ 
  userId, 
  initialDate, 
  onSuccess, 
  onCancel,
  editingEntry 
}: TimeEntryFormProps) {
  const [formData, setFormData] = useState<TimeEntryFormData>({
    entry_date: initialDate || new Date().toISOString().split('T')[0],
    work_type_level1_id: '',
    work_type_level2_id: '',
    project_id: null,
    hours: 0,
    notes: ''
  })

  const [workTypesLevel1, setWorkTypesLevel1] = useState<WorkTypeLevel1[]>([])
  const [level2Options, setLevel2Options] = useState<WorkTypeLevel2[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedLevel2, setSelectedLevel2] = useState<WorkTypeLevel2 | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  // Populate form if editing
  useEffect(() => {
    if (editingEntry) {
      setFormData({
        entry_date: editingEntry.entry_date,
        work_type_level1_id: editingEntry.work_type_level1_id,
        work_type_level2_id: editingEntry.work_type_level2_id,
        project_id: editingEntry.project_id,
        hours: editingEntry.hours,
        notes: editingEntry.notes || ''
      })
    }
  }, [editingEntry])

  const loadData = async () => {
    try {
      const [workTypes, activeProjects] = await Promise.all([
        WorkTypeService.getGroupedByLevel1(),
        ProjectService.getActive()
      ])
      
      setWorkTypesLevel1(workTypes)
      setProjects(activeProjects)

      // If editing, set level2 options
      if (editingEntry?.work_type_level1_id) {
        const level1 = workTypes.find(wt => wt.id === editingEntry.work_type_level1_id)
        if (level1) {
          setLevel2Options(level1.level2Options || [])
          const level2 = (level1.level2Options || []).find(l2 => l2.id === editingEntry.work_type_level2_id)
          setSelectedLevel2(level2 || null)
        }
      }
    } catch (error) {
      console.error('Failed to load form data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLevel1Change = (level1Id: string) => {
    const level1 = workTypesLevel1.find(wt => wt.id === level1Id)
    
    setFormData(prev => ({
      ...prev,
      work_type_level1_id: level1Id,
      work_type_level2_id: ''
    }))
    
    setLevel2Options(level1?.level2Options || [])
    setSelectedLevel2(null)
    setErrors(prev => ({ ...prev, work_type_level1_id: '', work_type_level2_id: '' }))
  }

  const handleLevel2Change = (level2Id: string) => {
    const level2 = level2Options.find(l2 => l2.id === level2Id)
    
    setFormData(prev => ({
      ...prev,
      work_type_level2_id: level2Id
    }))
    
    setSelectedLevel2(level2 || null)
    setErrors(prev => ({ ...prev, work_type_level2_id: '' }))
  }

  const handleHoursChange = (value: string) => {
    const hours = parseFloat(value) || 0
    
    // Validate 0.25 increments
    if (!TimeEntryService.validateHoursIncrement(hours)) {
      setErrors(prev => ({ 
        ...prev, 
        hours: 'Hours must be in 0.25 increments (e.g., 1.25, 2.5, 3.75)' 
      }))
    } else if (hours > 16) {
      setErrors(prev => ({ 
        ...prev, 
        hours: 'Hours cannot exceed 16 per day' 
      }))
    } else {
      setErrors(prev => ({ ...prev, hours: '' }))
    }
    
    setFormData(prev => ({ ...prev, hours }))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.entry_date) {
      newErrors.entry_date = 'Date is required'
    }

    if (!formData.work_type_level1_id) {
      newErrors.work_type_level1_id = 'Work Type Level 1 is required'
    }

    if (!formData.work_type_level2_id) {
      newErrors.work_type_level2_id = 'Work Type Level 2 is required'
    }

    if (formData.hours <= 0) {
      newErrors.hours = 'Hours must be greater than 0'
    }

    if (!TimeEntryService.validateHoursIncrement(formData.hours)) {
      newErrors.hours = 'Hours must be in 0.25 increments'
    }

    if (formData.hours > 16) {
      newErrors.hours = 'Hours cannot exceed 16 per day'
    }

    // Require project unless it's a leave type
    if (!selectedLevel2?.is_leave_type && !formData.project_id) {
      newErrors.project_id = 'Project is required for non-leave entries'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsSaving(true)
    setSuccessMessage('')

    try {
      // Validate daily hours limit
      const validation = await TimeEntryService.validateHours(
        userId,
        formData.entry_date,
        formData.hours,
        editingEntry?.id
      )

      if (!validation.valid) {
        setErrors({ hours: validation.message || 'Hours validation failed' })
        setIsSaving(false)
        return
      }

      if (editingEntry) {
        await TimeEntryService.update(editingEntry.id, formData, userId)
        setSuccessMessage('Time entry updated successfully')
      } else {
        await TimeEntryService.create(formData, userId)
        setSuccessMessage('Time entry created successfully')
      }

      // Reset form
      setTimeout(() => {
        setFormData({
          entry_date: initialDate || new Date().toISOString().split('T')[0],
          work_type_level1_id: '',
          work_type_level2_id: '',
          project_id: null,
          hours: 0,
          notes: ''
        })
        setLevel2Options([])
        setSelectedLevel2(null)
        setSuccessMessage('')
        
        if (onSuccess) onSuccess()
      }, 1500)

    } catch (error: any) {
      console.error('Failed to save entry:', error)
      setErrors({ submit: error.message || 'Failed to save time entry' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check size={18} />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="font-medium">{errors.submit}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.entry_date}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, entry_date: e.target.value }))
              setErrors(prev => ({ ...prev, entry_date: '' }))
            }}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${
              errors.entry_date ? 'border-red-300 bg-red-50' : 'border-slate-300'
            }`}
          />
          {errors.entry_date && (
            <p className="mt-1 text-xs text-red-600">{errors.entry_date}</p>
          )}
        </div>

        {/* Hours */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Hours <span className="text-red-500">*</span>
            <span className="text-xs font-normal text-slate-500 ml-2">(0.25 increments)</span>
          </label>
          <input
            type="number"
            step="0.25"
            min="0.25"
            max="16"
            value={formData.hours || ''}
            onChange={(e) => handleHoursChange(e.target.value)}
            placeholder="e.g., 8.0 or 8.25"
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${
              errors.hours ? 'border-red-300 bg-red-50' : 'border-slate-300'
            }`}
          />
          {errors.hours && (
            <p className="mt-1 text-xs text-red-600">{errors.hours}</p>
          )}
        </div>

        {/* Work Type Level 1 */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Work Type (Level 1) <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.work_type_level1_id}
            onChange={(e) => handleLevel1Change(e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${
              errors.work_type_level1_id ? 'border-red-300 bg-red-50' : 'border-slate-300'
            }`}
          >
            <option value="">Select Level 1...</option>
            {workTypesLevel1.map(wt => (
              <option key={wt.id} value={wt.id}>
                {wt.id} - {wt.description}
              </option>
            ))}
          </select>
          {errors.work_type_level1_id && (
            <p className="mt-1 text-xs text-red-600">{errors.work_type_level1_id}</p>
          )}
        </div>

        {/* Work Type Level 2 */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Work Type (Level 2) <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.work_type_level2_id}
            onChange={(e) => handleLevel2Change(e.target.value)}
            disabled={!formData.work_type_level1_id}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:bg-slate-100 disabled:cursor-not-allowed ${
              errors.work_type_level2_id ? 'border-red-300 bg-red-50' : 'border-slate-300'
            }`}
          >
            <option value="">Select Level 2...</option>
            {level2Options.map(l2 => (
              <option key={l2.id} value={l2.id}>
                {l2.id} - {l2.description}
              </option>
            ))}
          </select>
          {errors.work_type_level2_id && (
            <p className="mt-1 text-xs text-red-600">{errors.work_type_level2_id}</p>
          )}
        </div>

        {/* Billable Flag Indicator */}
        {selectedLevel2 && (
          <div className="md:col-span-2">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${
              selectedLevel2.billable 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                selectedLevel2.billable ? 'bg-emerald-500' : 'bg-slate-400'
              }`}></div>
              <span className="text-sm font-bold">
                {selectedLevel2.billable ? 'Billable' : 'Non-Billable'}
              </span>
              {selectedLevel2.is_leave_type && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold ml-2">
                  LEAVE TYPE
                </span>
              )}
            </div>
          </div>
        )}

        {/* Project/Client */}
        {selectedLevel2 && !selectedLevel2.is_leave_type && (
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Project / Client <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.project_id || ''}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, project_id: e.target.value || null }))
                setErrors(prev => ({ ...prev, project_id: '' }))
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${
                errors.project_id ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
            >
              <option value="">Select Project...</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.project_code} - {project.project_name} ({project.client_name})
                </option>
              ))}
            </select>
            {errors.project_id && (
              <p className="mt-1 text-xs text-red-600">{errors.project_id}</p>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={3}
            placeholder="Add any additional notes or details..."
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <X size={18} />
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              {editingEntry ? 'Update Entry' : 'Add Entry'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
