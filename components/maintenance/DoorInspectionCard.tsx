'use client'

import { useEffect, useMemo, useState, memo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useWatch, type Control, type UseFormRegister } from 'react-hook-form'
import { ChecklistSection } from './ChecklistMatrix'
import { PhotoUploader } from './PhotoUploader'
import { createSupabaseClient } from '@/lib/supabase/client'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import type { MaintenanceDoorForm, MaintenanceChecklistStatus } from '@/lib/types/maintenance.types'
import type { MaintenanceDoorPhoto } from '@/lib/types/maintenance.types'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

function calculateDoorCompletion(door: MaintenanceDoorForm): string {
  const total = MAINTENANCE_CHECKLIST_ITEMS.length
  const done = MAINTENANCE_CHECKLIST_ITEMS.filter(item => Boolean(door.checklist[item.code])).length
  return `${done}/${total} checklist items complete`
}

type DoorInspectionCardProps = {
  control: Control<MaintenanceFormValues>
  index: number
  reportId?: string
  register: UseFormRegister<MaintenanceFormValues>
  update: (index: number, value: MaintenanceDoorForm) => void
  availableDoors: Array<{ id: string; door_label: string; door_type: string }>
  hasFault?: boolean
  faultCount?: number
  onGenerateSummary: () => void
  isGeneratingSummary?: boolean
  disabled?: boolean
  isOffline?: boolean
}

type DoorInspectionHistoryItem = {
  created_at: string
  technician_notes: string
}

export const DoorInspectionCard = memo(function DoorInspectionCard({
  control,
  index,
  reportId,
  register,
  update,
  availableDoors,
  hasFault = false,
  faultCount = 0,
  onGenerateSummary,
  isGeneratingSummary = false,
  disabled = false,
  isOffline = false,
}: DoorInspectionCardProps) {
  const { isOnline } = useOnlineStatus()
  const door = useWatch({ control, name: `doors.${index}` }) as MaintenanceDoorForm | undefined
  const completionLabel = door ? calculateDoorCompletion(door) : '0/0 checklist items complete'

  const toDigitsOnly = (value: string) => value.replace(/\D+/g, '')
  const supabase = useMemo(() => createSupabaseClient(), [])
  const [history, setHistory] = useState<DoorInspectionHistoryItem[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  // Must run before any early return — avoids hook-order bugs and request storms in production/dev.
  useEffect(() => {
    const doorId = door?.door_id ? String(door.door_id).trim() : ''

    const networkBlocked =
      isOffline ||
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !isOnline

    if (networkBlocked || !doorId) {
      setHistory([])
      setIsHistoryLoading(false)
      return
    }

    let cancelled = false

    const loadHistory = async () => {
      // Double-check right before hitting the network (DevTools offline / flaky navigator.onLine).
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cancelled) {
          setHistory([])
          setIsHistoryLoading(false)
        }
        return
      }

      try {
        if (!cancelled) setIsHistoryLoading(true)
        const { data, error } = await supabase
          .from('door_inspections')
          .select('technician_notes, created_at')
          .eq('door_id', doorId)
          .order('created_at', { ascending: false })
          .limit(5)

        if (cancelled) return

        if (error) {
          console.error('Failed to load door inspection history:', { doorId, error })
          setHistory([])
          return
        }

        const nextHistory = (data ?? []).map(row => {
          const record = row as Record<string, unknown>

          return {
            created_at: String(record.created_at ?? ''),
            technician_notes: String(record.technician_notes ?? '').trim(),
          }
        })

        setHistory(nextHistory)
      } catch (error) {
        if (!cancelled) {
          console.error('Unexpected error while loading history:', { doorId, error })
          setHistory([])
        }
      } finally {
        if (!cancelled) setIsHistoryLoading(false)
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [door?.door_id, isOffline, isOnline, supabase])

  if (!door) return null

  const doorNumberLabel = String(door.door_number ?? '').trim() || String(index + 1)
  const cyclesNum = Number(door.door_cycles)
  const cyclesDisplay = cyclesNum > 0 && !Number.isNaN(cyclesNum) ? cyclesNum : 'N/A'
  const visibilityPct = door.view_window_visibility

  const formatHistoryDate = (item: DoorInspectionHistoryItem) => {
    const raw = item.created_at
    if (!raw) return 'Unknown date'
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return 'Unknown date'
    return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
  }

  return (
    <section className={`mx-auto w-full max-w-screen-md rounded-2xl border bg-white shadow-sm ${hasFault ? 'border-red-300' : 'border-slate-200'}`}>
      <button
        type="button"
        onClick={() => update(index, { ...door, isCollapsed: !door.isCollapsed })}
        className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-blue-900">Door {doorNumberLabel}</h3>
            {hasFault && (
              <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
                Fault Detected{faultCount > 0 ? ` (${faultCount})` : ''}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm">
            Door Type: {door.door_type || '—'} &nbsp; | &nbsp; Cycles: {cyclesDisplay} &nbsp; | &nbsp; View Window Visibility: {visibilityPct}%
          </p>
          <hr className="my-3 border-t border-dashed border-gray-400" />
          <p className="text-xs text-slate-500">{completionLabel}</p>
        </div>
        {door.isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
      </button>

      {!door.isCollapsed && (
        <div className="space-y-5 border-t border-slate-100 px-4 py-4">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700">
              Door Number
              <select
                value={door.door_id ?? ''}
                onChange={event => {
                  const selectedDoorId = event.target.value
                  const selected = availableDoors.find(d => d.id === selectedDoorId)
                  if (selected) {
                    update(index, {
                      ...door,
                      door_id: selected.id,
                      door_number: selected.door_label,
                      door_type: selected.door_type || '',
                    })
                  } else {
                    // Offline-safe fallback: allow selection even if availableDoors is empty/stale.
                    // This prevents the dropdown from instantly "snapping back" to empty.
                    const rawLabel = String(event.target.selectedOptions?.[0]?.text ?? '').trim()
                    const [labelPart, typePart] = rawLabel.split(' - ').map(s => s.trim())
                    update(index, {
                      ...door,
                      door_id: selectedDoorId ? selectedDoorId : undefined,
                      door_number: selectedDoorId ? (labelPart || door.door_number) : '',
                      door_type: selectedDoorId ? (typePart || door.door_type) : '',
                    })
                  }
                }}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 pb-2 text-base"
              >
                <option value="">Select a door</option>
                {availableDoors.map(option => (
                  <option key={option.id} value={option.id}>
                    {`${option.door_label} - ${option.door_type || 'Door'}`}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Door Type
                <input
                  type="text"
                  value={door.door_type}
                  onChange={event => update(index, { ...door, door_type: event.target.value })}
                  className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 pb-2 text-base"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Door Cycles
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter door cycle count"
                  {...register(`doors.${index}.door_cycles`, {
                    required: true,
                    setValueAs: value => {
                      const digits = toDigitsOnly(String(value ?? ''))
                      return digits === '' ? 0 : Number(digits)
                    },
                  })}
                  onInput={event => {
                    const input = event.currentTarget
                    input.value = toDigitsOnly(input.value)
                  }}
                  className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 pb-2 text-base"
                />
                <p className="mt-1 text-xs text-slate-500">Enter the door cycle count from the control panel.</p>
              </label>

              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                View Window Visibility (%)
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0 - 100"
                  {...register(`doors.${index}.view_window_visibility`, {
                    required: true,
                    min: 0,
                    max: 100,
                    setValueAs: value => {
                      const digits = toDigitsOnly(String(value ?? ''))
                      return digits === '' ? 0 : Number(digits)
                    },
                  })}
                  onInput={event => {
                    const input = event.currentTarget
                    input.value = toDigitsOnly(input.value)
                  }}
                  className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 pb-2 text-base"
                />
                <p className="mt-1 text-xs text-slate-500">Enter percentage visibility of door viewing panel.</p>
              </label>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h4 className="text-sm font-bold text-slate-800">Previous Maintenance History</h4>

            {isHistoryLoading ? (
              <p className="mt-2 text-xs text-slate-500">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No previous inspection history found for this door.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {history.map((item, historyIndex) => (
                  <article
                    key={`${item.created_at}-${historyIndex}`}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {formatHistoryDate(item)}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      <span className="font-semibold">Technician Notes:</span>{' '}
                      {item.technician_notes || '-'}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="overflow-x-auto">
            <ChecklistSection control={control} doorIndex={index} />
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Door Fault Notes
            <textarea
              {...register(`doors.${index}.notes`)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (!isOnline) return
              onGenerateSummary()
            }}
            disabled={!isOnline || disabled || isGeneratingSummary}
            title={!isOnline ? 'Requires internet connection' : undefined}
            className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            {isGeneratingSummary ? 'Improving...' : 'Improve / Rephrase Notes'}
          </button>
          {!isOnline && (
            <p className="mt-1 text-xs text-slate-500">AI note improvement is not available offline</p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Door Photos</p>
            <PhotoUploader
              reportId={reportId}
              doorId={door.local_id}
              photos={door.photos}
              onChange={photos => update(index, { ...door, photos })}
              disabled={disabled}
              isOffline={isOffline}
            />
          </div>
        </div>
      )}
    </section>
  )
})
