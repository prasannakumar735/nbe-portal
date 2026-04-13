'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { X, Trash2, AlertTriangle, Building2, MapPin } from 'lucide-react'
import { useTravelTime } from '@/hooks/useTravelTime'
import { findOverlappingEvents } from '@/hooks/useCalendarEvents'
import { supabase } from '@/lib/supabase'
import type {
  CalendarEventRow,
  CalendarLocationMode,
  EventType,
  EventStatus,
  ProfileOption,
} from '@/lib/calendar/types'
import { profileDisplayName } from '@/lib/auth/roles'
import { CALENDAR_DAY_START_HOUR } from '@/lib/constants'
import { coerceDurationMinutes } from '@/lib/calendar/duration'
import {
  clampDurationToWorkingDay,
  parseTimeToMinutes,
  validateTimedEventWindow,
} from '@/lib/calendar/workingHours'
import { splitRoundTripLegs } from '@/lib/calendar/eventDisplay'

/** Teams-style form controls: readable contrast, visible focus rings. */
const INPUT =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'
const INPUT_INVALID =
  'mt-1 w-full rounded-lg border border-rose-400 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-200 disabled:bg-gray-50'
const LABEL = 'text-xs font-medium uppercase tracking-wide text-gray-500'

const LS_LOCATION_MODE = 'nbe-calendar-event-location-mode'

function readSavedLocationMode(): CalendarLocationMode {
  if (typeof window === 'undefined') return 'manual'
  const v = window.localStorage.getItem(LS_LOCATION_MODE)
  return v === 'client' ? 'client' : 'manual'
}

function persistLocationMode(mode: CalendarLocationMode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_LOCATION_MODE, mode)
}

type ClientOption = { id: string; name: string }

type ClientLocationOption = {
  id: string
  client_id: string
  label: string
  address: string
  coords: { lat: number; lng: number } | null
}

function mapClientLocationRow(row: Record<string, unknown>): ClientLocationOption | null {
  const id = String(row.id ?? '')
  const client_id = String(row.client_id ?? '')
  if (!id || !client_id) return null
  const label =
    String(row.location_name ?? row.name ?? row.site_name ?? row.suburb ?? '').trim() || 'Site'
  const companyAddress = String(row.Company_address ?? '').trim()
  const normalizedCompanyAddress = companyAddress.toLowerCase() === 'null' ? '' : companyAddress
  const fallbackAddress = String(row.address ?? row.site_address ?? row.location_address ?? '').trim()
  const address = (normalizedCompanyAddress || fallbackAddress || label).trim()
  const lat = Number(row.lat ?? row.latitude)
  const lng = Number(row.lng ?? row.longitude)
  const coords =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  return { id, client_id, label, address, coords }
}

type FormState = {
  title: string
  description: string
  assigned_to: string
  event_type: EventType
  date: string
  is_full_day: boolean
  start_time: string
  duration_minutes: number
  location_mode: CalendarLocationMode
  client_id: string
  location_id: string
  location_text: string
  status: EventStatus
}

const defaultForm = (userId: string): FormState => ({
  title: '',
  description: '',
  assigned_to: userId,
  event_type: 'task',
  date: new Date().toISOString().slice(0, 10),
  is_full_day: false,
  start_time: '09:00',
  duration_minutes: 60,
  location_mode: readSavedLocationMode(),
  client_id: '',
  location_id: '',
  location_text: '',
  status: 'scheduled',
})

function timeDbToInput(t: string | null): string {
  if (!t) return '09:00'
  return t.slice(0, 5)
}

function toPgTime(input: string): string {
  const [a, b] = input.split(':')
  const h = Math.min(23, Math.max(0, parseInt(a ?? '0', 10)))
  const m = Math.min(59, Math.max(0, parseInt(b ?? '0', 10)))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

type Props = {
  open: boolean
  onClose: () => void
  canManage: boolean
  currentUserId: string
  assignees: ProfileOption[]
  allEvents: CalendarEventRow[]
  initial: CalendarEventRow | null
  /** When creating, pre-fill the calendar day (YYYY-MM-DD). */
  defaultDate?: string
  onCreate: (payload: {
    title: string
    description: string | null
    assigned_to: string
    event_type: EventType
    date: string
    is_full_day: boolean
    start_time: string | null
    duration_minutes: number | null
    client_id: string | null
    location_id: string | null
    location_mode: CalendarLocationMode
    location_text: string | null
    location_lat: number | null
    location_lng: number | null
    travel_minutes: number
    total_minutes: number
    status: EventStatus
  }) => Promise<void>
  onUpdate: (
    id: string,
    payload: {
      title: string
      description: string | null
      assigned_to: string
      event_type: EventType
      date: string
      is_full_day: boolean
      start_time: string | null
      duration_minutes: number | null
      client_id: string | null
      location_id: string | null
      location_mode: CalendarLocationMode
      location_text: string | null
      location_lat: number | null
      location_lng: number | null
      travel_minutes: number
      total_minutes: number
      status: EventStatus
    }
  ) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function EventModal({
  open,
  onClose,
  canManage,
  currentUserId,
  assignees,
  allEvents,
  initial,
  defaultDate,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [form, setForm] = useState<FormState>(() => defaultForm(currentUserId))
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<CalendarEventRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientLocations, setClientLocations] = useState<ClientLocationOption[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingLocations, setLoadingLocations] = useState(false)
  const {
    travelMinutes,
    setTravelMinutes,
    loadingTravel,
    travelError,
    setTravelError,
    computeFromLocation,
    computeTravelFromCoords,
    totalMinutesFor,
  } = useTravelTime()

  const readOnly = !canManage

  useEffect(() => {
    if (!open) return
    if (initial) {
      const mode: CalendarLocationMode = initial.location_mode === 'client' ? 'client' : 'manual'
      setForm({
        title: initial.title,
        description: initial.description ?? '',
        assigned_to: initial.assigned_to,
        event_type: initial.event_type,
        date: initial.date,
        is_full_day: initial.is_full_day,
        start_time: timeDbToInput(initial.start_time),
        duration_minutes: coerceDurationMinutes(initial.duration_minutes ?? 60),
        location_mode: mode,
        client_id: initial.client_id ?? '',
        location_id: initial.location_id ?? '',
        location_text: initial.location_text ?? '',
        status: initial.status,
      })
      if (initial.is_full_day) {
        setTravelMinutes(0)
        setLatLng(null)
      } else if (mode === 'client' && initial.location_lat != null && initial.location_lng != null) {
        const c = { lat: initial.location_lat, lng: initial.location_lng }
        setLatLng(c)
        setTravelMinutes(0)
        void computeTravelFromCoords(c, false)
      } else if (mode === 'manual') {
        const q = initial.location_text?.trim()
        if (q) {
          setTravelMinutes(0)
          setLatLng(
            initial.location_lat != null && initial.location_lng != null
              ? { lat: initial.location_lat, lng: initial.location_lng }
              : null
          )
          void computeFromLocation(q, false).then(r => {
            if (r.coords) setLatLng(r.coords)
          })
        } else {
          setLatLng(null)
          setTravelMinutes(0)
        }
      } else {
        const q = initial.location_text?.trim()
        setTravelMinutes(0)
        if (q) {
          void computeFromLocation(q, false).then(r => {
            if (r.coords) setLatLng(r.coords)
          })
        } else {
          setLatLng(null)
        }
      }
    } else {
      const base = defaultForm(currentUserId)
      setForm({
        ...base,
        date: defaultDate ?? base.date,
      })
      setLatLng(null)
      setTravelMinutes(0)
    }
    setOverlapWarning([])
    setTravelError(null)
  }, [
    open,
    initial,
    currentUserId,
    defaultDate,
    setTravelMinutes,
    setTravelError,
    computeFromLocation,
    computeTravelFromCoords,
  ])

  useEffect(() => {
    if (!open) return
    setLoadingClients(true)
    void supabase
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setClients((data as ClientOption[]).filter(c => c.id && c.name))
        } else {
          setClients([])
        }
        setLoadingClients(false)
      })
  }, [open])

  useEffect(() => {
    if (!open || !form.client_id) {
      setClientLocations([])
      return
    }
    setLoadingLocations(true)
    void supabase
      .from('client_locations')
      .select('*')
      .eq('client_id', form.client_id)
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) {
          setClientLocations([])
          setLoadingLocations(false)
          return
        }
        const mapped = (data as Record<string, unknown>[])
          .map(r => mapClientLocationRow(r))
          .filter((x): x is ClientLocationOption => Boolean(x))
          .sort((a, b) => a.label.localeCompare(b.label))
        setClientLocations(mapped)
        setLoadingLocations(false)

        if (
          mapped.length === 0 &&
          form.location_mode === 'client' &&
          !readOnly &&
          form.client_id
        ) {
          setForm(f => ({
            ...f,
            location_mode: 'manual',
            location_id: '',
            client_id: '',
            location_text: '',
          }))
          setLatLng(null)
          setTravelMinutes(0)
          setTravelError(null)
          persistLocationMode('manual')
        }
      })
  }, [open, form.client_id, form.location_mode, readOnly])

  const workingWindowCheck = useMemo(() => {
    if (form.is_full_day) return { ok: true as const }
    const sm = parseTimeToMinutes(form.start_time)
    if (sm === null) return { ok: false as const, message: 'Choose a valid start time.' }
    return validateTimedEventWindow(sm, coerceDurationMinutes(form.duration_minutes))
  }, [form.is_full_day, form.start_time, form.duration_minutes])

  const legacyOutsideHours =
    !!initial &&
    !initial.is_full_day &&
    (initial.duration_minutes ?? 0) > 0 &&
    initial.start_time != null &&
    initial.duration_minutes != null &&
    (() => {
      const sm = parseTimeToMinutes(timeDbToInput(initial.start_time))
      if (sm === null) return false
      const v = validateTimedEventWindow(sm, coerceDurationMinutes(initial.duration_minutes))
      return !v.ok
    })()

  const totalPreview = useMemo(
    () => totalMinutesFor(form.duration_minutes, travelMinutes, form.is_full_day),
    [form.duration_minutes, form.is_full_day, travelMinutes, totalMinutesFor]
  )

  const travelLegPreview = useMemo(
    () => (travelMinutes > 0 ? splitRoundTripLegs(travelMinutes) : null),
    [travelMinutes]
  )

  const assigneeOptions = useMemo(() => {
    const id = form.assigned_to
    if (!id || assignees.some(a => a.id === id)) return assignees
    return [
      ...assignees,
      { id, full_name: null, first_name: null, last_name: null, role: null } satisfies ProfileOption,
    ]
  }, [assignees, form.assigned_to])

  const handleLocationBlur = async () => {
    if (form.is_full_day || form.location_mode !== 'manual') return
    const q = form.location_text.trim()
    if (!q) {
      setLatLng(null)
      setTravelMinutes(0)
      setTravelError(null)
      return
    }
    const r = await computeFromLocation(q, form.is_full_day)
    if (r.coords) setLatLng(r.coords)
  }

  const applyLocationMode = (mode: CalendarLocationMode) => {
    persistLocationMode(mode)
    if (mode === 'manual') {
      setForm(f => ({
        ...f,
        location_mode: 'manual',
        client_id: '',
        location_id: '',
      }))
      setLatLng(null)
      setTravelMinutes(0)
      setTravelError(null)
    } else {
      setForm(f => ({
        ...f,
        location_mode: 'client',
        location_text: '',
      }))
      setLatLng(null)
      setTravelMinutes(0)
      setTravelError(null)
    }
  }

  const recomputeOverlap = (f: FormState) => {
    if (f.is_full_day) {
      const w = { start: 0, end: 24 * 60, isFullDay: true as const }
      const hits = findOverlappingEvents(
        { date: f.date, assigned_to: f.assigned_to, window: w },
        allEvents,
        initial?.id
      )
      setOverlapWarning(hits)
      return
    }
    const start = f.start_time
    const [hh, mm] = start.split(':').map(Number)
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
      setOverlapWarning([])
      return
    }
    const startMin = hh * 60 + mm
    const dur = coerceDurationMinutes(f.duration_minutes)
    if (dur <= 0) {
      setOverlapWarning([])
      return
    }
    const travel = Math.max(0, Math.round(travelMinutes))
    const w = { start: startMin, end: startMin + dur + travel, isFullDay: false }
    const hits = findOverlappingEvents(
      { date: f.date, assigned_to: f.assigned_to, window: w },
      allEvents,
      initial?.id
    )
    setOverlapWarning(hits)
  }

  useEffect(() => {
    if (!open) return
    recomputeOverlap(form)
  }, [
    open,
    form.date,
    form.assigned_to,
    form.is_full_day,
    form.start_time,
    form.duration_minutes,
    travelMinutes,
    allEvents,
    initial?.id,
  ])

  /** Debounced geocode + travel when manual address text changes (not only on blur). */
  useEffect(() => {
    if (!open || form.is_full_day || form.location_mode !== 'manual') return
    const q = form.location_text.trim()
    if (!q) return
    const id = window.setTimeout(() => {
      void (async () => {
        const r = await computeFromLocation(q, false)
        if (r.coords) setLatLng(r.coords)
      })()
    }, 550)
    return () => clearTimeout(id)
  }, [form.location_text, form.location_mode, open, form.is_full_day, computeFromLocation])

  const handleSubmit = async () => {
    if (readOnly) return
    if (!form.title.trim()) return
    if (!form.is_full_day && workingWindowCheck.ok === false) {
      alert(workingWindowCheck.message)
      return
    }

    if (!form.is_full_day) {
      if (form.location_mode === 'client') {
        if (!form.client_id || !form.location_id) {
          alert('Select a client and a site location.')
          return
        }
      } else if (!form.location_text.trim()) {
        alert('Enter a location, or switch to client location.')
        return
      }
    }

    const description = form.description.trim() || null
    const dur = coerceDurationMinutes(form.duration_minutes)

    let resolvedTravel = travelMinutes
    let resolvedLatLng: { lat: number; lng: number } | null = latLng
    let location_text: string | null = form.location_text.trim() || null
    let client_id: string | null = form.client_id || null
    let location_id: string | null = form.location_id || null
    let location_mode: CalendarLocationMode = form.location_mode

    if (form.is_full_day) {
      client_id = null
      location_id = null
      location_mode = 'manual'
      location_text = form.location_text.trim() || null
    } else if (form.location_mode === 'client') {
      const loc = clientLocations.find(l => l.id === form.location_id)
      if (!loc) {
        alert('Could not resolve that site. Refresh and try again.')
        return
      }
      location_text = loc.address || loc.label
      location_mode = 'client'
      client_id = form.client_id || null
      location_id = loc.id

      if (loc.coords) {
        resolvedLatLng = loc.coords
        resolvedTravel = await computeTravelFromCoords(loc.coords, false)
      } else if (loc.address) {
        const r = await computeFromLocation(loc.address, false)
        resolvedTravel = r.travel_minutes
        resolvedLatLng = r.coords ?? resolvedLatLng
        if (r.coords) setLatLng(r.coords)
        if (!r.coords) {
          alert('Could not geocode that site address. Use manual location or add coordinates to the site.')
          return
        }
      } else {
        alert('That site has no address coordinates. Add GPS or use manual location.')
        return
      }
    } else {
      location_mode = 'manual'
      client_id = null
      location_id = null
      const q = form.location_text.trim()
      const r = await computeFromLocation(q, false)
      resolvedTravel = r.travel_minutes
      resolvedLatLng = r.coords ?? resolvedLatLng
      if (r.coords) setLatLng(r.coords)
      location_text = q || null
      if (!r.coords) {
        alert('Could not find coordinates for that address. Enter a suburb or street in Australia.')
        return
      }
    }

    const payloadBase = {
      title: form.title.trim(),
      description,
      assigned_to: form.assigned_to,
      event_type: form.event_type,
      date: form.date,
      is_full_day: form.is_full_day,
      start_time: form.is_full_day ? null : toPgTime(form.start_time),
      duration_minutes: form.is_full_day ? null : dur,
      client_id,
      location_id,
      location_mode,
      location_text,
      location_lat: form.is_full_day ? null : resolvedLatLng?.lat ?? null,
      location_lng: form.is_full_day ? null : resolvedLatLng?.lng ?? null,
      travel_minutes: form.is_full_day ? 0 : resolvedTravel,
      total_minutes: form.is_full_day ? 0 : dur + resolvedTravel,
      status: form.status,
    }

    if (!form.is_full_day && overlapWarning.length > 0) {
      const ok = window.confirm(
        `This overlaps ${overlapWarning.length} existing booking(s) for that person. Save anyway?`
      )
      if (!ok) return
    }

    setSaving(true)
    try {
      if (initial) {
        await onUpdate(initial.id, payloadBase)
      } else {
        await onCreate(payloadBase)
      }
      onClose()
    } catch {
      alert('Could not save event. Check your connection and permissions.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial || !onDelete || readOnly) return
    if (!window.confirm('Delete this event?')) return
    setSaving(true)
    try {
      await onDelete(initial.id)
      onClose()
    } catch {
      alert('Could not delete.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const locationIncomplete =
    !form.is_full_day &&
    (form.location_mode === 'client'
      ? !form.client_id || !form.location_id
      : !form.location_text.trim())

  const submitDisabled =
    saving ||
    !form.title.trim() ||
    (!form.is_full_day && workingWindowCheck.ok === false) ||
    locationIncomplete

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-modal-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-3 py-8 sm:px-4 md:mx-auto md:px-6">
        <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 md:px-6">
          <div>
            <h2 id="calendar-event-modal-title" className="text-lg font-semibold text-gray-900">
              {readOnly ? 'Event details' : initial ? 'Edit event' : 'New event'}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">Schedule work, leave, blocks, or meetings.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-4 py-5 md:px-6">
          {legacyOutsideHours && readOnly && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
              This event was saved outside the current working window (7:00 AM–6:00 PM). It is shown clipped on the
              calendar.
            </div>
          )}
          {!form.is_full_day && workingWindowCheck.ok === false && canManage && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
              {workingWindowCheck.message}
            </div>
          )}
          {overlapWarning.length > 0 && (
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div>
                <p className="font-medium text-gray-900">Possible overlap</p>
                <ul className="mt-1 list-inside list-disc text-xs text-gray-700">
                  {overlapWarning.slice(0, 4).map(ev => (
                    <li key={ev.id}>
                      {ev.title} ({ev.date}
                      {!ev.is_full_day && ev.start_time ? ` · ${timeDbToInput(ev.start_time)}` : ''})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <label className="block">
            <span className={LABEL}>Title</span>
            <input
              type="text"
              disabled={readOnly}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className={INPUT}
              placeholder="Job or meeting title"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={LABEL}>Assign to</span>
              <select
                disabled={readOnly}
                value={form.assigned_to}
                onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                className={INPUT}
              >
                {assigneeOptions.map(p => (
                  <option key={p.id} value={p.id}>
                    {profileDisplayName(p) || p.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={LABEL}>Type</span>
              <select
                disabled={readOnly}
                value={form.event_type}
                onChange={e => setForm(f => ({ ...f, event_type: e.target.value as EventType }))}
                className={INPUT}
              >
                <option value="task">Task</option>
                <option value="block">Block</option>
                <option value="leave">Leave</option>
                <option value="meeting">Meeting</option>
              </select>
            </label>

            <label className="block">
              <span className={LABEL}>Status</span>
              <select
                disabled={readOnly}
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as EventStatus }))}
                className={INPUT}
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className={LABEL}>Date</span>
            <input
              type="date"
              disabled={readOnly}
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className={INPUT}
            />
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={form.is_full_day}
              onChange={e => {
                const is_full_day = e.target.checked
                setForm(f => ({ ...f, is_full_day }))
                if (is_full_day) {
                  setTravelMinutes(0)
                  setLatLng(null)
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/30"
            />
            <span className="text-sm font-medium text-gray-900">Full day</span>
          </label>

          {!form.is_full_day && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Start time</span>
                  <input
                    type="time"
                    disabled={readOnly}
                    min={`${String(CALENDAR_DAY_START_HOUR).padStart(2, '0')}:00`}
                    value={form.start_time}
                    onChange={e => {
                      const nextStart = e.target.value
                      setForm(f => {
                        if (f.is_full_day) return { ...f, start_time: nextStart }
                        const sm = parseTimeToMinutes(nextStart)
                        if (sm === null) return { ...f, start_time: nextStart }
                        const capped = clampDurationToWorkingDay(sm, f.duration_minutes)
                        return { ...f, start_time: nextStart, duration_minutes: capped }
                      })
                    }}
                    className={!readOnly && workingWindowCheck.ok === false ? INPUT_INVALID : INPUT}
                  />
                  <p className="mt-1 text-[11px] text-gray-500">Between 7:00 AM and 6:00 PM</p>
                </label>
                <label className="block">
                  <span className={LABEL}>Duration (minutes)</span>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    disabled={readOnly}
                    value={form.duration_minutes}
                    onChange={e => {
                      const raw = Math.max(0, parseInt(e.target.value, 10) || 0)
                      setForm(f => {
                        if (f.is_full_day) return { ...f, duration_minutes: raw }
                        const sm = parseTimeToMinutes(f.start_time)
                        if (sm === null) return { ...f, duration_minutes: raw }
                        const capped = clampDurationToWorkingDay(sm, raw)
                        return { ...f, duration_minutes: capped }
                      })
                    }}
                    className={!readOnly && workingWindowCheck.ok === false ? INPUT_INVALID : INPUT}
                  />
                </label>
              </div>

              <div className="block">
                <span className={LABEL}>Location</span>
                <div className="mt-1 mb-2 flex gap-2">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => applyLocationMode('client')}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                      form.location_mode === 'client'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span aria-hidden>🏢</span>
                    <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Client location
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => applyLocationMode('manual')}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                      form.location_mode === 'manual'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span aria-hidden>📍</span>
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Manual location
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Select a client location or switch to manual entry.
                </p>

                {form.location_mode === 'client' ? (
                  <div className="mt-2 space-y-3">
                    <label className="block">
                      <span className={LABEL}>Client</span>
                      <select
                        disabled={readOnly || loadingClients}
                        value={form.client_id}
                        onChange={e => {
                          const id = e.target.value
                          setForm(f => ({
                            ...f,
                            client_id: id,
                            location_id: '',
                            location_text: '',
                          }))
                          setLatLng(null)
                          setTravelMinutes(0)
                          setTravelError(null)
                        }}
                        className={INPUT}
                      >
                        <option value="">{loadingClients ? 'Loading clients…' : 'Select a client'}</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={LABEL}>Site</span>
                      <select
                        disabled={readOnly || !form.client_id || loadingLocations}
                        value={form.location_id}
                        onChange={e => {
                          const id = e.target.value
                          const loc = clientLocations.find(l => l.id === id)
                          setForm(f => ({
                            ...f,
                            location_id: id,
                            location_text: loc?.address ?? '',
                          }))
                          if (!loc) {
                            setLatLng(null)
                            setTravelMinutes(0)
                            return
                          }
                          void (async () => {
                            if (loc.coords) {
                              setLatLng(loc.coords)
                              await computeTravelFromCoords(loc.coords, false)
                            } else if (loc.address) {
                              setLatLng(null)
                              const r = await computeFromLocation(loc.address, false)
                              if (r.coords) setLatLng(r.coords)
                            } else {
                              setLatLng(null)
                              setTravelMinutes(0)
                            }
                          })()
                        }}
                        className={INPUT}
                      >
                        <option value="">
                          {!form.client_id
                            ? 'Select a client first'
                            : loadingLocations
                              ? 'Loading sites…'
                              : clientLocations.length === 0
                                ? 'No locations available'
                                : 'Select a site'}
                        </option>
                        {clientLocations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.label}
                            {loc.address && loc.address !== loc.label ? ` — ${loc.address}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <label className="mt-2 block">
                    <span className="sr-only">Manual location</span>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={form.location_text}
                      onChange={e => setForm(f => ({ ...f, location_text: e.target.value }))}
                      onBlur={() => void handleLocationBlur()}
                      className={INPUT}
                      placeholder="Enter suburb or address"
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Travel (return)</span>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-orange-600">
                    <span className="mr-0.5" aria-hidden>
                      🚗
                    </span>
                    {loadingTravel ? '…' : `${travelMinutes} min`}
                  </p>
                  {!loadingTravel && travelMinutes > 0 && travelLegPreview && (
                    <p className="mt-1 text-[10px] leading-snug text-gray-500">
                      → To site: {travelLegPreview.toSite} min · ← Return: {travelLegPreview.returnLeg} min (factory →
                      job → factory)
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Total time</span>
                  <p className="mt-0.5 font-semibold tabular-nums text-gray-900">
                    {form.is_full_day ? '—' : `${totalPreview} min`}
                  </p>
                </div>
                {travelError && <p className="w-full text-xs text-rose-600">{travelError}</p>}
              </div>
            </>
          )}

          <label className="block">
            <span className={LABEL}>Notes</span>
            <textarea
              disabled={readOnly}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className={INPUT}
              placeholder="Access details, parts, customer notes…"
            />
          </label>

        </div>

        <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50/80 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 md:px-6">
          {initial && initial.event_type === 'task' && (canManage || initial.assigned_to === currentUserId) && (
            <Link
              href={`/job-card/${initial.id}`}
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:order-first sm:mr-auto sm:w-auto"
            >
              Job card
            </Link>
          )}
          {canManage && initial && onDelete && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100 sm:mr-auto sm:w-auto"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 sm:w-auto"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
            {!readOnly && (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitDisabled}
              className="w-full rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 enabled:bg-blue-600 enabled:text-white enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300 sm:w-auto"
            >
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Create event'}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
