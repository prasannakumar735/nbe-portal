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
import { coerceDurationMinutes } from '@/lib/calendar/duration'
import { parseTimeToMinutes, validateTimedEventWindow } from '@/lib/calendar/workingHours'
import { normalizeCalendarEventEndDate } from '@/lib/calendar/multiDay'
import { mergeAssigneeProfilesIntoEvents } from '@/lib/calendar/assignees'
import { findOverlappingEvents, getEventWindow, type EventWindow } from '@/lib/calendar/overlap'

export { findOverlappingEvents, getEventWindow, type EventWindow } from '@/lib/calendar/overlap'

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

  const endRaw = rest.end_date as string | null | undefined
  const endNorm = typeof endRaw === 'string' && endRaw.trim() ? endRaw.trim() : null

  return {
    ...(rest as Omit<CalendarEventRow, 'location_mode' | 'client_name' | 'client_location_label' | 'assignees'>),
    location_mode,
    client_id: (rest.client_id as string | null | undefined) ?? null,
    location_id: (rest.location_id as string | null | undefined) ?? null,
    client_name: clients?.name?.trim() ?? null,
    client_location_label,
    end_date: endNorm,
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

function endTimeFromStartAndTotal(startTime: string, workMinutes: number, travelMinutes: number): string {
  const start = timeToMinutes(startTime)
  if (start === null) return '00:00:00'
  const end = start + coerceDurationMinutes(workMinutes) + Math.max(0, Math.round(travelMinutes))
  const hh = Math.floor(end / 60) % 24
  const mm = end % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
}

function normalizeAssigneeList(assigned_to: string, assignees?: string[] | undefined): string[] {
  const base = assignees?.length ? assignees : [assigned_to]
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of base.map(x => String(x ?? '').trim()).filter(Boolean)) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

async function syncCalendarEventAssignees(eventId: string, userIds: string[]): Promise<void> {
  const uniq = [...new Set(userIds.map(id => String(id).trim()))].filter(Boolean)
  const { error: delErr } = await supabase.from('calendar_event_assignees').delete().eq('event_id', eventId)
  if (delErr) throw delErr
  if (uniq.length === 0) return
  const { error: insErr } = await supabase
    .from('calendar_event_assignees')
    .insert(uniq.map(user_id => ({ event_id: eventId, user_id })))
  if (insErr) throw insErr
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
      const rangeLowerOr = `end_date.gte.${from},and(end_date.is.null,date.gte.${from})`

      let res = await supabase
        .from('calendar_events')
        .select(calendarSelect)
        .lte('date', to)
        .or(rangeLowerOr)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      if (res.error) {
        res = await supabase
          .from('calendar_events')
          .select('*')
          .lte('date', to)
          .or(rangeLowerOr)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
      }

      if (res.error) throw res.error
      let mapped = ((res.data ?? []) as Record<string, unknown>[]).map(r => mapCalendarEventFromDb(r))

      const ids = mapped.map(e => e.id).filter(Boolean)
      if (ids.length > 0) {
        try {
          const { data: ceaRows, error: ceaErr } = await supabase
            .from('calendar_event_assignees')
            .select('event_id,user_id')
            .in('event_id', ids)
          if (!ceaErr && Array.isArray(ceaRows) && ceaRows.length > 0) {
            const pids = [...new Set((ceaRows as { user_id?: string }[]).map(r => String(r.user_id ?? '').trim()).filter(Boolean))]
            let profileMap: Record<string, string | null> = {}
            if (pids.length > 0) {
              const { data: profs } = await supabase.from('profiles').select('id,full_name').in('id', pids)
              if (Array.isArray(profs)) {
                profileMap = Object.fromEntries(
                  (profs as { id: string; full_name?: string | null }[]).map(p => [
                    p.id,
                    (p.full_name ?? '').trim() || null,
                  ])
                )
              }
            }
            mapped = mergeAssigneeProfilesIntoEvents(mapped, ceaRows as { event_id: string; user_id: string }[], profileMap)
          }
        } catch {
          /* join table absent on old environments — degrade to assigned_to-only */
        }
      }

      setEvents(mapped)
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
      assignees?: string[]
      event_type: EventType
      date: string
      end_date: string | null
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

      const assigneeChain = normalizeAssigneeList(payload.assigned_to, payload.assignees)
      const assigned_to = assigneeChain[0] ?? payload.assigned_to

      const end_date = normalizeCalendarEventEndDate({
        event_type: payload.event_type,
        is_full_day: payload.is_full_day,
        date: payload.date,
        end_date: payload.end_date,
      })

      const durInsert = payload.is_full_day ? null : coerceDurationMinutes(payload.duration_minutes)

      let end_time: string | null = null
      if (!payload.is_full_day && payload.start_time && durInsert != null && durInsert > 0) {
        end_time = endTimeFromStartAndTotal(payload.start_time, durInsert, payload.travel_minutes)
      }

      const row = {
        title: payload.title,
        description: payload.description,
        assigned_to,
        created_by: uid,
        event_type: payload.event_type,
        date: payload.date,
        end_date,
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
      let inserted = mapCalendarEventFromDb(data as Record<string, unknown>)

      if (canManage) {
        await syncCalendarEventAssignees(inserted.id, assigneeChain)
      }

      /** Local row: approximate assignees via profile ids only (labels filled on next refresh). */
      if (assigneeChain.length > 1 || canManage) {
        inserted = {
          ...inserted,
          assignees: assigneeChain.map(id => ({
            id,
            full_name: assigneeNameById.get(id) ?? null,
          })),
        }
      }

      setEvents(prev => [...prev, inserted].sort((a, b) => a.date.localeCompare(b.date)))

      const notifyTargets = assigneeChain
      if (notifyTargets.some(id => id !== uid)) {
        void fetch('/api/notifications/calendar-event-assigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ event_id: inserted.id }),
        }).catch(err => {
          console.warn('[useCalendarEvents] Calendar assignee notification failed', err)
        })
      }

      return inserted
    },
    [assigneeNameById, canManage]
  )

  const updateEvent = useCallback(
    async (
      id: string,
      payload: {
        title: string
        description: string | null
        assigned_to: string
        assignees?: string[]
        event_type: EventType
        date: string
        end_date: string | null
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

      const assigneeChain = normalizeAssigneeList(payload.assigned_to, payload.assignees)
      const assigned_to = assigneeChain[0] ?? payload.assigned_to

      const end_date = normalizeCalendarEventEndDate({
        event_type: payload.event_type,
        is_full_day: payload.is_full_day,
        date: payload.date,
        end_date: payload.end_date,
      })

      const durUpdate = payload.is_full_day ? null : coerceDurationMinutes(payload.duration_minutes)

      let end_time: string | null = null
      if (!payload.is_full_day && payload.start_time && durUpdate != null && durUpdate > 0) {
        end_time = endTimeFromStartAndTotal(payload.start_time, durUpdate, payload.travel_minutes)
      }

      const row = {
        title: payload.title,
        description: payload.description,
        assigned_to,
        event_type: payload.event_type,
        date: payload.date,
        end_date,
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
      let updated = mapCalendarEventFromDb(data as Record<string, unknown>)

      if (canManage) {
        await syncCalendarEventAssignees(id, assigneeChain)
        updated = {
          ...updated,
          assignees: assigneeChain.map(uid => ({
            id: uid,
            full_name: assigneeNameById.get(uid) ?? null,
          })),
        }
      }

      setEvents(prev => prev.map(x => (x.id === id ? updated : x)))
      return updated
    },
    [assigneeNameById, canManage]
  )

  const deleteEvent = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('calendar_events').delete().eq('id', id)
    if (e) throw e
    setEvents(prev => prev.filter(x => x.id !== id))
  }, [])

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
