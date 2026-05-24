import { blockTotalMinutes } from '@/lib/calendar/eventDisplay'
import { coerceDurationMinutes } from '@/lib/calendar/duration'
import {
  calendarDateRangesOverlap,
  calendarEventEffectiveEndIso,
  normalizeCalendarEventEndDate,
} from '@/lib/calendar/multiDay'
import { calendarEventAssigneeIds } from '@/lib/calendar/assignees'
import type { CalendarEventRow, EventType } from '@/lib/calendar/types'

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

function assigneeSetsIntersect(a: string[], b: string[]): boolean {
  const set = new Set(a)
  return b.some(id => set.has(id))
}

/** Timed/full-day overlap for any shared assignee (multi-assignee) or legacy single assignee match. */
export function findOverlappingEvents(
  candidate: {
    date: string
    end_date?: string | null
    event_type: EventType
    assigned_to: string
    /** Explicit assignee IDs; defaults to `[assigned_to]` when empty. */
    assignee_ids?: string[]
    window: EventWindow
  },
  existing: CalendarEventRow[],
  excludeId?: string
): CalendarEventRow[] {
  const candIdsRaw =
    candidate.assignee_ids && candidate.assignee_ids.length > 0
      ? candidate.assignee_ids
      : [candidate.assigned_to].filter(Boolean)
  const candIds = [...new Set(candIdsRaw.map(id => String(id).trim()))].filter(Boolean)

  const candSpanEnd = candidate.window.isFullDay
    ? normalizeCalendarEventEndDate({
        event_type: candidate.event_type,
        is_full_day: true,
        date: candidate.date,
        end_date: candidate.end_date,
      }) ?? candidate.date
    : candidate.date

  return existing.filter(ev => {
    if (ev.id === excludeId) return false
    const evIds = calendarEventAssigneeIds(ev)
    if (!assigneeSetsIntersect(candIds, evIds)) return false

    const evSpanEnd = calendarEventEffectiveEndIso(ev)

    if (!calendarDateRangesOverlap(candidate.date, candSpanEnd, ev.date, evSpanEnd)) {
      return false
    }

    if (candidate.window.isFullDay && ev.is_full_day) {
      return true
    }

    if (candidate.window.isFullDay && !ev.is_full_day) {
      const w = getEventWindow(ev)
      return Boolean(w && candSpanEnd >= ev.date && candidate.date <= ev.date)
    }

    if (!candidate.window.isFullDay && ev.is_full_day) {
      return candidate.date >= ev.date && candidate.date <= evSpanEnd
    }

    const w = getEventWindow(ev)
    if (!w) return false
    return candidate.date === ev.date && windowsOverlap(candidate.window, w)
  })
}
