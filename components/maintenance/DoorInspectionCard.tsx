'use client'

import { useEffect, useMemo, useState, memo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  Controller,
  useWatch,
  type Control,
  type FieldPath,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form'
import { ChecklistSection } from './ChecklistMatrix'
import { PhotoUploader } from './PhotoUploader'
import { createSupabaseClient } from '@/lib/supabase/client'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import type {
  DoorMasterSnapshot,
  MaintenanceAvailableDoor,
  MaintenanceDoorForm,
  MaintenanceChecklistStatus,
} from '@/lib/types/maintenance.types'
import type { MaintenanceDoorPhoto } from '@/lib/types/maintenance.types'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import { doorMasterSnapshotFromRegistry } from '@/lib/maintenance/doorMasterFromRegistry'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/** Select value when technician adds a door not listed in the site registry. */
const OPTION_ADD_DOOR_MANUALLY = '__adhoc_manual__'

/** Server / legacy default stored when door_type was empty — show as empty/— in the UI, not a fake user value. */
function formatInspectorDoorType(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s || s.toLowerCase() === 'unspecified') return '—'
  return s
}

function emptyDoorMaster(): DoorMasterSnapshot {
  return {
    door_description: null,
    door_type_alt: null,
    cw: null,
    ch: null,
  }
}

function calculateDoorCompletion(door: MaintenanceDoorForm): string {
  const total = MAINTENANCE_CHECKLIST_ITEMS.length
  const done = MAINTENANCE_CHECKLIST_ITEMS.filter(item => Boolean(door.checklist[item.code])).length
  return `${done}/${total} checklist items complete`
}

type DoorInspectionCardProps = {
  control: Control<MaintenanceFormValues>
  index: number
  /** Read latest row from RHF store — `useWatch` can lag one tick; manual fields must merge from this. */
  getValues: UseFormGetValues<MaintenanceFormValues>
  /** Prefer nested `setValue` for manual door fields — avoids `useFieldArray.update` full-row races while typing. */
  setValue: UseFormSetValue<MaintenanceFormValues>
  reportId?: string
  register: UseFormRegister<MaintenanceFormValues>
  update: (index: number, value: MaintenanceDoorForm) => void
  availableDoors: MaintenanceAvailableDoor[]
  /** `>= 2` enables door master snapshot + technician door details (new reports only). */
  reportSchemaVersion: number
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
  getValues,
  setValue,
  reportId,
  register,
  update,
  availableDoors,
  reportSchemaVersion,
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

  const getLatestDoor = (): MaintenanceDoorForm | undefined => getValues().doors?.[index]

  const setLeafOpts = { shouldDirty: true, shouldValidate: false } as const
  const doorBasePath = `doors.${index}` as const

  const setManualDoorNumber = (value: string) => {
    setValue(`${doorBasePath}.door_number` as FieldPath<MaintenanceFormValues>, value, setLeafOpts)
  }

  const setMasterField = (key: keyof DoorMasterSnapshot, value: string | null) => {
    const row = getValues(`doors.${index}`)
    const existing = row?.door_master
    if (!existing) {
      setValue(`${doorBasePath}.door_master` as FieldPath<MaintenanceFormValues>, { ...emptyDoorMaster(), [key]: value }, setLeafOpts)
    } else {
      setValue(`${doorBasePath}.door_master.${key}` as FieldPath<MaintenanceFormValues>, value, setLeafOpts)
    }
  }

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

  const doorDetailsEnabled = reportSchemaVersion >= 2
  const master = door.door_master
  const registryMasterReadonly =
    doorDetailsEnabled &&
    !door.adhoc_manual &&
    master &&
    [master.door_description, master.door_type_alt, master.cw, master.ch].some(v => String(v ?? '').trim())

  const selectDoorValue = door.door_id?.trim()
    ? door.door_id
    : door.adhoc_manual
      ? OPTION_ADD_DOOR_MANUALLY
      : ''

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
        onClick={() => {
          const latest = getLatestDoor()
          if (!latest) return
          update(index, { ...latest, isCollapsed: !latest.isCollapsed })
        }}
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
            Door Type: {formatInspectorDoorType(door.door_type)} &nbsp; | &nbsp; Cycles: {cyclesDisplay} &nbsp; | &nbsp; View Window
            Visibility: {visibilityPct}%
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
              Door (site registry)
              <select
                value={selectDoorValue}
                onChange={event => {
                  const base = getLatestDoor() ?? door
                  if (!base) return
                  const selectedDoorId = event.target.value
                  if (selectedDoorId === OPTION_ADD_DOOR_MANUALLY) {
                    update(index, {
                      ...base,
                      door_id: undefined,
                      adhoc_manual: true,
                      door_number: base.door_number?.trim() || `Door ${index + 1}`,
                      door_type: base.door_type ?? '',
                      door_master: base.door_master ?? emptyDoorMaster(),
                      technician_door_details: base.technician_door_details ?? '',
                    })
                    return
                  }
                  if (selectedDoorId === '') {
                    update(index, {
                      ...base,
                      door_id: undefined,
                      adhoc_manual: false,
                      door_number: `Door ${index + 1}`,
                      door_type: '',
                      door_master: undefined,
                      technician_door_details: '',
                    })
                    return
                  }
                  const selected = availableDoors.find(d => d.id === selectedDoorId)
                  if (selected) {
                    const masterSnap = doorDetailsEnabled ? doorMasterSnapshotFromRegistry(selected) : undefined
                    const sameDoor = String(base.door_id ?? '') === selected.id
                    update(index, {
                      ...base,
                      adhoc_manual: false,
                      door_id: selected.id,
                      door_number: selected.door_label,
                      door_type: selected.door_type || '',
                      door_master: masterSnap,
                      technician_door_details: sameDoor ? (base.technician_door_details ?? '') : '',
                    })
                  } else {
                    // Offline-safe fallback: allow selection even if availableDoors is empty/stale.
                    const rawLabel = String(event.target.selectedOptions?.[0]?.text ?? '').trim()
                    const [labelPart, typePart] = rawLabel.split(' - ').map(s => s.trim())
                    update(index, {
                      ...base,
                      adhoc_manual: false,
                      door_id: selectedDoorId ? selectedDoorId : undefined,
                      door_number: selectedDoorId ? (labelPart || base.door_number) : '',
                      door_type: selectedDoorId ? (typePart || base.door_type) : '',
                      door_master: undefined,
                      technician_door_details: '',
                    })
                  }
                }}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 pb-2 text-base"
              >
                <option value="">Select a door</option>
                {availableDoors.map(option => {
                  const regType = String(option.door_type ?? '').trim()
                  const typeSuffix =
                    !regType || regType.toLowerCase() === 'unspecified' ? 'Door' : regType
                  return (
                    <option key={option.id} value={option.id}>
                      {`${option.door_label} - ${typeSuffix}`}
                    </option>
                  )
                })}
                <option value={OPTION_ADD_DOOR_MANUALLY}>+ Add door manually (not in list)…</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Choose a door from the list, or add one manually if the site has extra doors not in the registry.
              </p>
            </label>

            {door.adhoc_manual && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm text-slate-800">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Manual door</p>
                <p className="mt-1 text-xs text-amber-900/90">
                  Enter the label as it should appear on the report (e.g. Door 1). Optional fields are stored with this
                  inspection and used when the door record is created on save.
                </p>
                <label className="mt-3 block text-sm font-medium text-slate-800">
                  Door label
                  <input
                    type="text"
                    value={door.door_number}
                    onChange={e => {
                      setManualDoorNumber(e.target.value)
                    }}
                    placeholder="e.g. Door 1, North roller"
                    className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
                  />
                </label>
                {doorDetailsEnabled && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
                      Description
                      <textarea
                        value={String(door.door_master?.door_description ?? '')}
                        onChange={e => {
                          const v = e.target.value
                          setMasterField('door_description', v === '' ? null : v)
                        }}
                        rows={2}
                        placeholder="Optional description"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-800">
                      Alternate type
                      <input
                        type="text"
                        value={String(door.door_master?.door_type_alt ?? '')}
                        onChange={e => {
                          const v = e.target.value
                          setMasterField('door_type_alt', v === '' ? null : v)
                        }}
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-800">
                      CW
                      <input
                        type="text"
                        value={String(door.door_master?.cw ?? '')}
                        onChange={e => {
                          const v = e.target.value
                          setMasterField('cw', v === '' ? null : v)
                        }}
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-800">
                      CH
                      <input
                        type="text"
                        value={String(door.door_master?.ch ?? '')}
                        onChange={e => {
                          const v = e.target.value
                          setMasterField('ch', v === '' ? null : v)
                        }}
                        className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {registryMasterReadonly && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-800">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Door record (read-only)</p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {String(master?.door_description ?? '').trim() ? (
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">Description</dt>
                      <dd className="whitespace-pre-wrap text-slate-800">{String(master?.door_description)}</dd>
                    </div>
                  ) : null}
                  {String(master?.door_type_alt ?? '').trim() ? (
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">Alternate type</dt>
                      <dd>{String(master?.door_type_alt)}</dd>
                    </div>
                  ) : null}
                  {String(master?.cw ?? '').trim() ? (
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">CW</dt>
                      <dd>{String(master?.cw)}</dd>
                    </div>
                  ) : null}
                  {String(master?.ch ?? '').trim() ? (
                    <div>
                      <dt className="text-xs font-semibold text-slate-500">CH</dt>
                      <dd>{String(master?.ch)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            )}

            {doorDetailsEnabled && (
              <label className="block text-sm font-medium text-slate-700">
                Technician door details
                <textarea
                  {...register(`doors.${index}.technician_door_details`)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
                  placeholder="Additional context for this inspection (optional)"
                />
              </label>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Door Type
                <Controller
                  control={control}
                  name={`${doorBasePath}.door_type` as FieldPath<MaintenanceFormValues>}
                  render={({ field }) => {
                    const raw = String(field.value ?? '')
                    const display = raw.trim().toLowerCase() === 'unspecified' ? '' : raw
                    return (
                      <input
                        type="text"
                        value={display}
                        onChange={e => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 pb-2 text-base"
                      />
                    )
                  }}
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
              onChange={photos => {
                const latest = getLatestDoor()
                if (!latest) return
                update(index, { ...latest, photos })
              }}
              disabled={disabled}
              isOffline={isOffline}
            />
          </div>
        </div>
      )}
    </section>
  )
})
