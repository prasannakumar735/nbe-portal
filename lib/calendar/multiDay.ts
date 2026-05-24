import type { CalendarEventRow, EventType } from '@/lib/calendar/types'
import { addDays, formatIsoDate, parseIsoCalendarDate } from '@/lib/calendar/dates'

/** Last calendar day of the event (inclusive); single-day when `end_date` is null. */
export function calendarEventEffectiveEndIso(ev: CalendarEventRow): string {
  const ed = ev.end_date?.trim()
  if (ed && ed >= ev.date) return ed
  return ev.date
}

export function calendarEventTouchesDay(ev: CalendarEventRow, iso: string): boolean {
  const end = calendarEventEffectiveEndIso(ev)
  return ev.date <= iso && iso <= end
}

export function calendarEventIsMultiDayTask(ev: CalendarEventRow): boolean {
  return (
    ev.event_type === 'task' &&
    ev.is_full_day &&
    ev.end_date != null &&
    ev.end_date.trim() !== '' &&
    ev.end_date !== ev.date
  )
}

export type TaskSpanSegment = 'single' | 'first' | 'middle' | 'last'

/** Segment for Outlook/Teams-style continuation UI; null if the event does not appear on `iso`. */
export function calendarTaskSpanSegment(ev: CalendarEventRow, iso: string): TaskSpanSegment | null {
  if (!calendarEventTouchesDay(ev, iso)) return null
  if (!calendarEventIsMultiDayTask(ev)) {
    return ev.date === iso ? 'single' : null
  }
  const end = calendarEventEffectiveEndIso(ev)
  if (ev.date === end) return iso === ev.date ? 'single' : null
  if (iso === ev.date) return 'first'
  if (iso === end) return 'last'
  return 'middle'
}

export function calendarDateRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA <= endB && endA >= startB
}

/** All ISO days touched by `ev` (inclusive span). Bounded to ~5 years guard. */
export function calendarEventEnumerateIsoDays(ev: CalendarEventRow): string[] {
  const endIso = calendarEventEffectiveEndIso(ev)
  let cur = parseIsoCalendarDate(ev.date)
  const endParsed = parseIsoCalendarDate(endIso)
  if (!cur || !endParsed) return [ev.date]
  const out: string[] = []
  let i = 0
  while (true) {
    const iso = formatIsoDate(cur)
    if (iso > endIso) break
    out.push(iso)
    if (i++ > 366 * 5) break
    cur = addDays(cur, 1)
  }
  return out.length > 0 ? out : [ev.date]
}

/** Normalize DB/app value: omit redundant same-day spans. */
export function normalizeCalendarEventEndDate(params: {
  event_type: EventType
  is_full_day: boolean
  date: string
  end_date: string | null | undefined
}): string | null {
  if (params.event_type !== 'task' || !params.is_full_day) return null
  const tail = params.end_date?.trim()
  if (!tail || tail < params.date) return null
  if (tail === params.date) return null
  return tail
}

function clampDayIndex(n: number): number {
  return Math.max(0, Math.min(6, n))
}

/** One row in the Outlook-style week strip (Mon..Sun indexes 0–6). */
export type MultiDayWeekSpanPlacement = {
  ev: CalendarEventRow
  startCol: number
  endCol: number
}

/**
 * Visible segment of multi-day full-day tasks for the Monday-started week containing `weekMonday`.
 */
export function multiDayWeekSpanPlacements(
  events: CalendarEventRow[],
  weekMonday: Date
): MultiDayWeekSpanPlacement[] {
  const ws = parseIsoCalendarDate(formatIsoDate(weekMonday))
  if (!ws) return []

  const weekStartIso = formatIsoDate(ws)
  const weekEndIso = formatIsoDate(addDays(ws, 6))
  const out: MultiDayWeekSpanPlacement[] = []

  for (const ev of events) {
    if (!calendarEventIsMultiDayTask(ev)) continue

    const spanEndIso = calendarEventEffectiveEndIso(ev)
    if (ev.date > weekEndIso || spanEndIso < weekStartIso) continue

    const visStartIso = ev.date >= weekStartIso ? ev.date : weekStartIso
    const visEndIso = spanEndIso <= weekEndIso ? spanEndIso : weekEndIso

    const dS = parseIsoCalendarDate(visStartIso)
    const dE = parseIsoCalendarDate(visEndIso)
    if (!dS || !dE) continue

    const startColRaw = Math.round((dS.getTime() - ws.getTime()) / 86_400_000)
    const endColRaw = Math.round((dE.getTime() - ws.getTime()) / 86_400_000)
    const startCol = clampDayIndex(startColRaw)
    const endCol = clampDayIndex(endColRaw)
    if (startCol > endCol) continue

    out.push({ ev, startCol, endCol })
  }

  return out
}

export type PlacedWeekSpan = MultiDayWeekSpanPlacement & { row: number }

/**
 * Assign non-overlapping lane rows up to `maxLanes`; remaining placements go to `overflow`.
 * Intervals overlap if they share any day column [startCol,endCol].
 */
export function assignWeekSpanRows(
  spans: MultiDayWeekSpanPlacement[],
  maxLanes: number
): { placed: PlacedWeekSpan[]; overflow: MultiDayWeekSpanPlacement[] } {
  if (maxLanes <= 0) return { placed: [], overflow: spans }

  const sorted = [...spans].sort((a, b) => {
    const byStart = a.startCol - b.startCol
    if (byStart !== 0) return byStart
    return b.endCol - a.endCol
  })

  const laneEnds = Array.from({ length: maxLanes }, () => -1)
  const placed: PlacedWeekSpan[] = []
  const overflow: MultiDayWeekSpanPlacement[] = []

  outer: for (const p of sorted) {
    for (let r = 0; r < maxLanes; r++) {
      if (laneEnds[r] < p.startCol) {
        laneEnds[r] = p.endCol
        placed.push({ ...p, row: r })
        continue outer
      }
    }
    overflow.push(p)
  }

  return { placed, overflow }
}
