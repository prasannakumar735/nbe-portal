'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  CalendarEventRow,
  CalendarLocationMode,
  EventType,
  EventStatus,
  ProfileOption,
} from '@/lib/calendar/types'
import { blockTotalMinutes } from '@/lib/calendar/eventDisplay'
import { coerceDurationMinutes } from '@/lib/calendar/duration'
import { parseTimeToMinutes, validateTimedEventWindow } from '@/lib/calendar/workingHours'

function assertTimedEventInWorkingHours(
  isFullDay: boolean,
  startTime: string | null,
  durationMinutes: number | null
): void {
  if (isFullDay) return
  const dur = coerceDurationMinutes(durationMinutes)
  if (!startTime) throw new Error('Start time is required for timed events.')
  const compact = startTime.length > 5 ? startTime.slice(0, 5) : startTime
  const sm = parseTimeToMinutes(compact)
  if (sm === null) throw new Error('Invalid start time.')
  const v = validateTimedEventWindow(sm, dur)
  if (!v.ok) throw new Error(v.message)
}

function mapCalendarEventFromDb(row: Record<string, unknown>): CalendarEventRow {
  const clients = row.clients as { name?: string } | null | undefined
  const loc = row.client_locations as Record<string, unknown> | null | undefined
  const { clients: _clients, client_locations: _clientLocations, ...rest } = row

  const client_location_label = loc
    ? String(loc.location_name ?? loc.name ?? loc.site_name ?? loc.suburb ?? '').trim() || null
    : null

  const modeRaw = rest.location_mode
  const location_mode: CalendarLocationMode = modeRaw === 'client' ? 'client' : 'manual'

  return {
    ...(rest as Omit<CalendarEventRow, 'location_mode' | 'client_name' | 'client_location_label'>),
    location_mode,
    client_id: (rest.client_id as string | null | undefined) ?? null,
    location_id: (rest.location_id as string | null | undefined) ?? null,
    client_name: clients?.name?.trim() ?? null,
    client_location_label,
  }
}

function timeToMinutes(t: string | null): number | null {
  if (!t) return null
  const parts = t.split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parseInt(parts[1] ?? '0', 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

export type EventWindow = {
  start: number
  end: number
  isFullDay: boolean
}

export function getEventWindow(ev: CalendarEventRow): EventWindow | null {
  if (ev.is_full_day) {
    return { start: 0, end: 24 * 60, isFullDay: true }
  }
  const start = timeToMinutes(ev.start_time)
  const dur = coerceDurationMinutes(ev.duration_minutes)
  if (start === null || dur <= 0) return null
  const total = blockTotalMinutes(ev)
  return { start, end: start + total, isFullDay: false }
}

function windowsOverlap(a: EventWindow, b: EventWindow): boolean {
  return a.start < b.end && b.start < a.end
}

export function findOverlappingEvents(
  candidate: { date: string; assigned_to: string; window: EventWindow },
  existing: CalendarEventRow[],
  excludeId?: string
): CalendarEventRow[] {
  return existing.filter(ev => {
    if (ev.id === excludeId) return false
    if (ev.date !== candidate.date || ev.assigned_to !== candidate.assigned_to) return false
    const w = getEventWindow(ev)
    if (!w) return false
    return windowsOverlap(candidate.window, w)
  })
}

function endTimeFromStartAndTotal(startTime: string, workMinutes: number, travelMinutes: number): string {
  const start = timeToMinutes(startTime)
  if (start === null) return '00:00:00'
  const end = start + coerceDurationMinutes(workMinutes) + Math.max(0, Math.round(travelMinutes))
  const hh = Math.floor(end / 60) % 24
  const mm = end % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
}

export function useCalendarEvents(options: { userId: string; canManage: boolean }) {
  const { userId, canManage } = options
  const [events, setEvents] = useState<CalendarEventRow[]>([])
  const [assignees, setAssignees] = useState<ProfileOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAssignees = useCallback(async () => {
    if (!canManage) return
    const { data, error: e } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name, role')
      .eq('is_active', true)
      .neq('role', 'client')
      .order('full_name', { ascending: true })

    if (e) {
      return
    }
    setAssignees((data as ProfileOption[]) ?? [])
  }, [canManage])

  const fetchRange = useCallback(async (from: string, to: string) => {
    setLoading(true)
    setError(null)
    try {
      const calendarSelect = `
        *,
        clients ( name ),
        client_locations ( location_name, suburb )
      `
      let res = await supabase
        .from('calendar_events')
        .select(calendarSelect)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      if (res.error) {
        res = await supabase
          .from('calendar_events')
          .select('*')
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
      }

      if (res.error) throw res.error
      const rows = (res.data ?? []) as Record<string, unknown>[]
      setEvents(rows.map(r => mapCalendarEventFromDb(r)))
    } catch {
      setError('Could not load calendar')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAssignees()
  }, [loadAssignees])

  /** Ensure the signed-in user appears in the map for display names (employees may not be in manager list). */
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, role')
        .eq('id', userId)
        .maybeSingle()
      if (!data) return
      setAssignees(prev => (prev.some(p => p.id === data.id) ? prev : [data as ProfileOption, ...prev]))
    })()
  }, [userId])

  const assigneeNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of assignees) {
      const n =
        (p.full_name ?? '').trim() ||
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
        p.id.slice(0, 8)
      m.set(p.id, n)
    }
    return m
  }, [assignees])

  const resolveName = useCallback(
    (id: string) => {
      if (id === userId) {
        // self might not be in assignees list
        return assigneeNameById.get(id) ?? 'You'
      }
      return assigneeNameById.get(id) ?? id.slice(0, 8)
    },
    [assigneeNameById, userId]
  )

  const insertEvent = useCallback(
    async (payload: {
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
    }) => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) throw new Error('Not signed in')

      assertTimedEventInWorkingHours(payload.is_full_day, payload.start_time, payload.duration_minutes)

      const durInsert = payload.is_full_day ? null : coerceDurationMinutes(payload.duration_minutes)

      let end_time: string | null = null
      if (!payload.is_full_day && payload.start_time && durInsert != null && durInsert > 0) {
        end_time = endTimeFromStartAndTotal(payload.start_time, durInsert, payload.travel_minutes)
      }

      const row = {
        title: payload.title,
        description: payload.description,
        assigned_to: payload.assigned_to,
        created_by: uid,
        event_type: payload.event_type,
        date: payload.date,
        start_time: payload.is_full_day ? null : payload.start_time,
        end_time: payload.is_full_day ? null : end_time,
        is_full_day: payload.is_full_day,
        duration_minutes: payload.is_full_day ? null : durInsert,
        client_id: payload.client_id,
        location_id: payload.location_id,
        location_mode: payload.location_mode,
        location_text: payload.location_text,
        location_lat: payload.location_lat,
        location_lng: payload.location_lng,
        travel_minutes: payload.is_full_day ? 0 : payload.travel_minutes,
        total_minutes: payload.is_full_day ? 0 : payload.total_minutes,
        status: payload.status,
      }

      const { data, error: e } = await supabase.from('calendar_events').insert(row).select('*').single()
      if (e) throw e
      const inserted = mapCalendarEventFromDb(data as Record<string, unknown>)
      setEvents(prev => [...prev, inserted].sort((a, b) => a.date.localeCompare(b.date)))
      return inserted
    },
    []
  )

  const updateEvent = useCallback(
    async (
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
    ) => {
      assertTimedEventInWorkingHours(payload.is_full_day, payload.start_time, payload.duration_minutes)

      const durUpdate = payload.is_full_day ? null : coerceDurationMinutes(payload.duration_minutes)

      let end_time: string | null = null
      if (!payload.is_full_day && payload.start_time && durUpdate != null && durUpdate > 0) {
        end_time = endTimeFromStartAndTotal(payload.start_time, durUpdate, payload.travel_minutes)
      }

      const row = {
        title: payload.title,
        description: payload.description,
        assigned_to: payload.assigned_to,
        event_type: payload.event_type,
        date: payload.date,
        start_time: payload.is_full_day ? null : payload.start_time,
        end_time: payload.is_full_day ? null : end_time,
        is_full_day: payload.is_full_day,
        duration_minutes: payload.is_full_day ? null : durUpdate,
        client_id: payload.client_id,
        location_id: payload.location_id,
        location_mode: payload.location_mode,
        location_text: payload.location_text,
        location_lat: payload.location_lat,
        location_lng: payload.location_lng,
        travel_minutes: payload.is_full_day ? 0 : payload.travel_minutes,
        total_minutes: payload.is_full_day ? 0 : payload.total_minutes,
        status: payload.status,
      }

      const { data, error: e } = await supabase.from('calendar_events').update(row).eq('id', id).select('*').single()
      if (e) throw e
      const updated = mapCalendarEventFromDb(data as Record<string, unknown>)
      setEvents(prev => prev.map(x => (x.id === id ? updated : x)))
      return updated
    },
    []
  )

  const deleteEvent = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('calendar_events').delete().eq('id', id)
    if (e) throw e
    setEvents(prev => prev.filter(x => x.id !== id))
  }, [])

  /**
   * Board drag/resize: update timed fields (start, duration, travel, totals, end_time).
   * Does not replace full `updateEvent` form payload — optimized for scheduler patches.
   */
  const patchEventSchedule = useCallback(
    async (
      id: string,
      patch: { date?: string; start_time: string; duration_minutes: number; travel_minutes: number }
    ) => {
      assertTimedEventInWorkingHours(false, patch.start_time, patch.duration_minutes)
      const dur = coerceDurationMinutes(patch.duration_minutes)
      const travel = Math.max(0, Math.round(patch.travel_minutes))
      const total_minutes = dur + travel
      let end_time: string | null = null
      if (patch.start_time && dur > 0) {
        end_time = endTimeFromStartAndTotal(patch.start_time, dur, travel)
      }

      const updateRow: Record<string, unknown> = {
        start_time: patch.start_time,
        end_time,
        duration_minutes: dur,
        travel_minutes: travel,
        total_minutes,
      }
      if (patch.date) updateRow.date = patch.date

      const { data, error: e } = await supabase.from('calendar_events').update(updateRow).eq('id', id).select('*').single()
      if (e) throw e
      const updated = mapCalendarEventFromDb(data as Record<string, unknown>)
      setEvents(prev => prev.map(x => (x.id === id ? updated : x)))
      return updated
    },
    []
  )

  return {
    events,
    assignees,
    assigneeNameById,
    resolveName,
    loading,
    error,
    fetchRange,
    insertEvent,
    updateEvent,
    deleteEvent,
    patchEventSchedule,
    loadAssignees,
  }
}
