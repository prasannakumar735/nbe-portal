'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardPaste, Copy, X } from 'lucide-react'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import { defaultBillableFromLevel1Code } from '@/lib/timecard/billableDefaults'
import { computeEntryTotalHours } from '@/lib/timecard/computeHours'
import { isLeaveLevel1Code } from '@/lib/timecard/leaveWorkType'
import { officeClockBreakForTimeRange } from '@/lib/officeClock/breakPolicy'
import { getCurrentLocation } from '@/lib/timecard/getCurrentLocation'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { InlineCreateClientPanel } from '@/components/clients/InlineCreateClientPanel'
import type {
  CreateClientWithLocationPayload,
  CreateClientWithLocationResult,
} from '@/lib/clients/createMaintenanceClient'

type ClientOpt = { id: string; name: string }
type LocOpt = { id: string; name: string }
type L1 = { id: string; code: string; name: string }
type L2 = { id: string; name: string; billable: boolean }

function draftWithTierBreak<T extends { start_time: string; end_time: string; break_minutes: number }>(
  d: T,
): T {
  return { ...d, break_minutes: officeClockBreakForTimeRange(d.start_time, d.end_time) }
}

type CreateClientPayload = CreateClientWithLocationPayload
type CreateClientResult = CreateClientWithLocationResult

export type TimecardModalProps = {
  open: boolean
  entry: EmployeeTimesheetEntry | null
  readOnly: boolean
  onClose: () => void
  onSave: (entry: EmployeeTimesheetEntry) => void
  /** Prefill from the chronologically previous entry in the week */
  onFillFromPrevious?: () => void
  canFillFromPrevious?: boolean
  /** Create a duplicate line (new id) and close */
  onDuplicateEntry?: () => void
  clients: ClientOpt[]
  locations: LocOpt[]
  level1Options: L1[]
  level2Options: L2[]
  onClientChange: (clientId: string) => Promise<void>
  onLevel1Change: (level1Id: string) => Promise<void>
  /** True only for manager/admin editing (not manager-view read-only). */
  canCreateClient?: boolean
  onCreateClient?: (payload: CreateClientPayload) => Promise<CreateClientResult>
}

export function TimecardModal({
  open,
  entry,
  readOnly,
  onClose,
  onSave,
  onFillFromPrevious,
  canFillFromPrevious = false,
  onDuplicateEntry,
  clients,
  locations,
  level1Options,
  level2Options,
  onClientChange,
  onLevel1Change,
  canCreateClient = false,
  onCreateClient,
}: TimecardModalProps) {
  const [draft, setDraft] = useState<EmployeeTimesheetEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** UX for automatic gps_start when modal opens (not shown in read-only). */
  const [gpsStartUi, setGpsStartUi] = useState<'idle' | 'loading' | 'captured' | 'unavailable'>('idle')

  const [subProjectOpts, setSubProjectOpts] = useState<Array<{ id: string; name: string }>>([])
  const [subProjectsLoading, setSubProjectsLoading] = useState(false)

  /** Sync draft from props only when the open entry identity / copied fields change — not on unrelated parent re-renders. */
  const entrySyncKey = useMemo(() => {
    if (!entry) return ''
    return [
      entry.id,
      entry.client_id ?? '',
      entry.client_sub_project_id ?? '',
      entry.location_id ?? '',
      entry.work_type_level1_id ?? '',
      entry.work_type_level2_id ?? '',
      entry.entry_date,
    ].join('|')
  }, [entry])

  useEffect(() => {
    if (!open || !entry) return
    setDraft({ ...entry })
    setError(null)
    setGpsStartUi('idle')
    const cid = entry.client_id ? String(entry.client_id) : ''
    const l1 = entry.work_type_level1_id ? String(entry.work_type_level1_id) : ''
    void onClientChange(cid)
    void onLevel1Change(l1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entrySyncKey tracks entry identity; on* are stable from parent
  }, [open, entrySyncKey, onClientChange, onLevel1Change])

  useEffect(() => {
    if (!open || !draft?.client_id) {
      setSubProjectOpts([])
      setSubProjectsLoading(false)
      return
    }
    const clientId = String(draft.client_id).trim()
    let cancelled = false
    setSubProjectsLoading(true)
    void fetch(`/api/clients/sub-projects?clientId=${encodeURIComponent(clientId)}`)
      .then(res => res.json() as Promise<{ subProjects?: Array<{ id: string; name: string }> }>)
      .then(data => {
        if (cancelled) return
        const list = data.subProjects ?? []
        setSubProjectOpts(list)
        if (list.length === 0) {
          setDraft(prev => (prev?.client_sub_project_id ? { ...prev, client_sub_project_id: null } : prev))
        }
      })
      .catch(() => {
        if (!cancelled) setSubProjectOpts([])
      })
      .finally(() => {
        if (!cancelled) setSubProjectsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, draft?.client_id])

  /** Capture gps_start once draft matches the open entry (avoids racing the entry → draft sync). */
  useEffect(() => {
    if (!open || readOnly || !entry || !draft || draft.id !== entry.id) return
    let cancelled = false
    setGpsStartUi('loading')
    void getCurrentLocation().then(result => {
      if (cancelled) return
      if (result.ok) {
        setDraft(d =>
          d && d.id === entry.id
            ? {
                ...d,
                gps_start: {
                  lat: result.lat,
                  lng: result.lng,
                  ...(result.accuracy != null ? { accuracy: result.accuracy } : {}),
                },
                gps_start_address: null,
                gps_start_meta: null,
              }
            : d,
        )
        setGpsStartUi('captured')
      } else {
        setGpsStartUi('unavailable')
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, readOnly, entry?.id, draft?.id])

  const hoursPreview = useMemo(() => {
    if (!draft) return { hours: 0, error: null as string | null }
    return computeEntryTotalHours(draft.start_time, draft.end_time, draft.break_minutes)
  }, [draft])

  const clientOptions = useMemo(
    () => clients.map(c => ({ label: c.name, value: c.id })),
    [clients],
  )
  const locationOptions = useMemo(
    () => locations.map(loc => ({ label: loc.name, value: loc.id })),
    [locations],
  )
  const workTypeOptions = useMemo(
    () => level1Options.map(l => ({ label: `${l.code} — ${l.name}`, value: l.id })),
    [level1Options],
  )
  const taskOptions = useMemo(
    () => level2Options.map(l => ({ label: l.name, value: l.id })),
    [level2Options],
  )

  const level1CodeById = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of level1Options) m.set(l.id, l.code ?? '')
    return m
  }, [level1Options])

  const draftIsLeave = useMemo(() => {
    if (!draft?.work_type_level1_id) return false
    return isLeaveLevel1Code(level1CodeById.get(String(draft.work_type_level1_id)))
  }, [draft?.work_type_level1_id, level1CodeById])

  const handleLocationSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value || null
    setDraft(prev => (prev ? { ...prev, location_id: v } : prev))
  }, [])

  /** If the selected client has no locations, keep location null and hide the dropdown. */
  useEffect(() => {
    if (!open || !draft) return
    const hasClient = Boolean(String(draft.client_id ?? '').trim())
    if (!hasClient) return
    if (locations.length !== 0) return
    if (draft.location_id == null || String(draft.location_id).trim() === '') return
    setDraft(prev => (prev ? { ...prev, location_id: null } : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- location_id reset is intentional when locations list is empty
  }, [open, draft?.client_id, locations.length])

  const handleWorkTypeSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value || null
      const code = v ? level1CodeById.get(v) : undefined
      const leave = isLeaveLevel1Code(code)
      const billable = leave ? false : defaultBillableFromLevel1Code(code)
      setDraft(prev =>
        prev
          ? {
              ...prev,
              work_type_level1_id: v,
              work_type_level2_id: null,
              billable: v ? billable : false,
              ...(leave
                ? {
                    client_id: null,
                    client_sub_project_id: null,
                    location_id: null,
                  }
                : {}),
            }
          : prev,
      )
      void onLevel1Change(v ?? '')
    },
    [onLevel1Change, level1CodeById],
  )

  const handleTaskSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value || null
      setDraft(prev => {
        if (!prev) return prev
        const l1 = prev.work_type_level1_id ? level1CodeById.get(String(prev.work_type_level1_id)) : undefined
        const leave = isLeaveLevel1Code(l1)
        return {
          ...prev,
          work_type_level2_id: id,
          ...(leave ? { billable: false } : {}),
        }
      })
    },
    [level1CodeById],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /** Lock page scroll while modal is open (portal renders outside main scroll region). */
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const prevBodyOverflow = document.body.style.overflow
    const prevBodyOverflowX = document.body.style.overflowX
    const prevHtmlOverflow = html.style.overflow
    const prevHtmlOverflowX = html.style.overflowX
    document.body.style.overflow = 'hidden'
    document.body.style.overflowX = 'hidden'
    html.style.overflow = 'hidden'
    html.style.overflowX = 'hidden'
    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.body.style.overflowX = prevBodyOverflowX
      html.style.overflow = prevHtmlOverflow
      html.style.overflowX = prevHtmlOverflowX
    }
  }, [open])

  if (!open || !draft) {
    return null
  }

  if (typeof window === 'undefined') {
    return null
  }

  const submit = async () => {
    const { hours, error: er } = computeEntryTotalHours(draft.start_time, draft.end_time, draft.break_minutes)
    if (er) {
      setError(er)
      return
    }

    let gps_end = draft.gps_end ?? null
    let gps_end_address = draft.gps_end_address ?? null
    let gps_end_meta = draft.gps_end_meta ?? null
    if (!readOnly) {
      const endResult = await getCurrentLocation()
      if (endResult.ok) {
        gps_end = {
          lat: endResult.lat,
          lng: endResult.lng,
          ...(endResult.accuracy != null ? { accuracy: endResult.accuracy } : {}),
        }
        gps_end_address = null
        gps_end_meta = null
      }
    }

    onSave({
      ...draft,
      total_hours: hours,
      gps_end,
      gps_end_address,
      gps_end_meta,
    })
  }

  const selectWrapClass = 'block w-full min-w-0 max-w-full'
  const fieldClass =
    'mt-1.5 block w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500'
  const labelClass = 'block min-w-0 text-xs font-semibold text-slate-600'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-black/40 p-4 max-sm:p-2"
      role="presentation"
    >
      {/* createPortal(..., document.body): fixed overlay is viewport-relative, not clipped by sidebar/main. */}
      <div
        className="relative my-auto flex w-full max-w-4xl min-h-0 max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-sm:mx-0 max-sm:max-h-[100dvh] max-sm:rounded-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timecard-entry-title"
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0 flex-1">
            <h2 id="timecard-entry-title" className="text-lg font-semibold text-slate-900">
              {readOnly ? 'View entry' : 'Edit entry'}
            </h2>
            <p className="text-xs font-medium text-slate-500">{draft.entry_date}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {!readOnly && onFillFromPrevious ? (
              <button
                type="button"
                title="Fill from previous line in this week"
                disabled={!canFillFromPrevious}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => onFillFromPrevious()}
              >
                <ClipboardPaste className="size-3.5" aria-hidden />
                Copy previous
              </button>
            ) : null}
            {!readOnly && onDuplicateEntry ? (
              <button
                type="button"
                title="Duplicate this entry"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => onDuplicateEntry()}
              >
                <Copy className="size-3.5" aria-hidden />
                Duplicate
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-6">
          <div className="min-w-0 space-y-6">
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="min-w-0 space-y-4">
              {!draftIsLeave ? (
              <div className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-gray-50 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Client & place</p>
                <div className="space-y-4">
                  <label className={labelClass}>
                    <span className="sr-only">Client</span>
                    <div className="-mt-1.5">
                      <SearchableSelect
                        id="timecard-client"
                        label="Client"
                        value={draft.client_id ?? ''}
                        disabled={readOnly}
                        options={clientOptions}
                        allowEmpty
                        emptyLabel="Select client"
                        placeholder="Search clients…"
                        onChange={(next) => {
                          const v = next || null
                          setDraft(prev =>
                            prev ? { ...prev, client_id: v, location_id: null, client_sub_project_id: null } : prev,
                          )
                          void onClientChange(next ?? '')
                        }}
                      />
                    </div>
                  </label>

                  {!readOnly && canCreateClient && onCreateClient ? (
                    <InlineCreateClientPanel
                      onCreate={onCreateClient}
                      onCreated={async created => {
                        await onClientChange(created.client.id)
                        setDraft(prev =>
                          prev
                            ? {
                                ...prev,
                                client_id: created.client.id,
                                client_sub_project_id: null,
                                location_id: created.location?.id ?? null,
                              }
                            : prev,
                        )
                      }}
                    />
                  ) : null}

                  {draft.client_id && subProjectOpts.length > 0 ? (
                    <label className={labelClass}>
                      <span className="sr-only">Sub-project</span>
                      <div className="-mt-1.5">
                        <SearchableSelect
                          id="timecard-sub-project"
                          label="Sub-project (optional)"
                          value={draft.client_sub_project_id ?? ''}
                          disabled={readOnly || subProjectsLoading}
                          options={subProjectOpts.map(o => ({ label: o.name, value: o.id }))}
                          allowEmpty
                          emptyLabel="No sub-project"
                          placeholder="Search sub-projects…"
                          onChange={next => {
                            const v = next || null
                            setDraft(prev => (prev ? { ...prev, client_sub_project_id: v } : prev))
                          }}
                        />
                      </div>
                      {subProjectsLoading ? (
                        <p className="mt-1 text-xs text-slate-500">Loading sub-projects…</p>
                      ) : null}
                    </label>
                  ) : null}

                  <label className={labelClass}>
                    {draft.client_id && locations.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        No locations set for this client.
                      </div>
                    ) : (
                      <>
                        Location <span className="font-normal text-slate-400">(optional)</span>
                        <span className={selectWrapClass}>
                          <select
                            disabled={readOnly || !draft.client_id}
                            className={fieldClass}
                            value={draft.location_id ?? ''}
                            onChange={handleLocationSelectChange}
                          >
                            <option value="">No location</option>
                            {locationOptions.map(o => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </span>
                      </>
                    )}
                  </label>
                </div>
              </div>
              ) : (
                <div className="rounded-xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-900">
                  Leave entry — client and location are not required.
                </div>
              )}

              <div className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-gray-50 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Work</p>
                <div className="space-y-4">
                  <label className={labelClass}>
                    Work type
                    <span className={selectWrapClass}>
                      <select
                        disabled={readOnly}
                        className={fieldClass}
                        value={draft.work_type_level1_id ?? ''}
                        onChange={handleWorkTypeSelectChange}
                      >
                        <option value="">Select category</option>
                        {workTypeOptions.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>

                  <label className={labelClass}>
                    Task
                    <span className={selectWrapClass}>
                      <select
                        disabled={readOnly || !draft.work_type_level1_id}
                        className={fieldClass}
                        value={draft.work_type_level2_id ?? ''}
                        onChange={handleTaskSelectChange}
                      >
                        <option value="">Select task</option>
                        {taskOptions.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>

                  <label className={labelClass}>
                    Task label
                    <input
                      disabled={readOnly}
                      className={fieldClass}
                      value={draft.task}
                      onChange={e => setDraft(d => (d ? { ...d, task: e.target.value } : d))}
                      placeholder="Short label (optional)"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-gray-50 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Time</p>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    Start
                    <input
                      type="time"
                      disabled={readOnly}
                      className={fieldClass}
                      value={draft.start_time.length > 5 ? draft.start_time.slice(0, 5) : draft.start_time}
                      onChange={e =>
                        setDraft(d => (d ? draftWithTierBreak({ ...d, start_time: e.target.value }) : d))
                      }
                    />
                  </label>
                  <label className={labelClass}>
                    End
                    <input
                      type="time"
                      disabled={readOnly}
                      className={fieldClass}
                      value={draft.end_time.length > 5 ? draft.end_time.slice(0, 5) : draft.end_time}
                      onChange={e =>
                        setDraft(d => (d ? draftWithTierBreak({ ...d, end_time: e.target.value }) : d))
                      }
                    />
                  </label>
                </div>
                <label className={`${labelClass} mt-4 block`}>
                  Break (minutes)
                  <input
                    type="number"
                    min={0}
                    disabled={readOnly}
                    className={fieldClass}
                    value={draft.break_minutes}
                    onChange={e =>
                      setDraft(d => (d ? { ...d, break_minutes: Math.max(0, Number(e.target.value) || 0) } : d))
                    }
                  />
                </label>

                <div
                  className={`mt-4 rounded-xl border px-4 py-3 ${
                    hoursPreview.error
                      ? 'border-red-200 bg-red-50'
                      : 'border-indigo-200 bg-indigo-50/80'
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Calculated hours</p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">Net time: start to end, minus break</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                    {hoursPreview.hours.toFixed(2)}
                    <span className="ml-1 text-base font-medium text-slate-600">h</span>
                  </p>
                  {hoursPreview.error ? (
                    <p className="mt-1 text-xs font-medium text-red-700">{hoursPreview.error}</p>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-gray-50 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Notes</p>
                <p className="text-xs font-medium text-slate-500">
                  Read-only — use the task and time fields above; office clock lines include an auto summary here.
                </p>
                <div
                  className={`${fieldClass} mt-2 min-h-[72px] whitespace-pre-wrap text-slate-800`}
                  aria-readonly="true"
                >
                  {(draft.notes ?? '').trim() ? draft.notes : '—'}
                </div>
              </div>

              <label className="flex min-w-0 cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-100 bg-gray-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Billable</p>
                </div>
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={draft.billable}
                  className="size-5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  onChange={e => setDraft(d => (d ? { ...d, billable: e.target.checked } : d))}
                />
              </label>
            </div>
            </div>

            {!readOnly ? (
              <p className="text-xs text-slate-500" aria-live="polite">
                {gpsStartUi === 'loading' ? 'Getting location…' : null}
                {gpsStartUi === 'captured' ? 'Location captured' : null}
                {gpsStartUi === 'unavailable'
                  ? 'Location not available — you can still save your entry.'
                  : null}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
            onClick={onClose}
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly ? (
            <button
              type="button"
              disabled={Boolean(draft.client_id && subProjectsLoading)}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void submit()}
            >
              Save entry
            </button>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
