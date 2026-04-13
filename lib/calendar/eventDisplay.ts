import { coerceDurationMinutes, parseDbTimeToMinutes } from '@/lib/calendar/duration'
import type { CalendarEventRow } from '@/lib/calendar/types'

/** Primary line shown on cards / lists for where the job is. */
export function calendarEventDisplayLocation(ev: CalendarEventRow): string | null {
  if (ev.location_mode === 'client') {
    const site = (ev.client_location_label ?? '').trim()
    const client = (ev.client_name ?? '').trim()
    if (site && client) return `${client} — ${site}`
    if (site) return site
    if (client) return client
  }
  const t = (ev.location_text ?? '').trim()
  return t || null
}

/** Split stored round-trip minutes into two legs (handles odd totals). */
export function splitRoundTripLegs(roundTripMinutes: number): { toSite: number; returnLeg: number } {
  const t = Math.max(0, Math.round(roundTripMinutes))
  const toSite = Math.floor(t / 2)
  return { toSite, returnLeg: t - toSite }
}

/** On-site + travel (minutes) for calendar block height and end time. */
export function blockTotalMinutes(ev: {
  duration_minutes: number | null
  travel_minutes: number
}): number {
  return coerceDurationMinutes(ev.duration_minutes) + Math.max(0, Math.round(ev.travel_minutes))
}

/**
 * Locale time range for the full block: start → start + work + travel.
 * Does not use DB `end_time` (derived from duration + travel only).
 */
export function formatEventTimeRange(ev: {
  start_time: string | null
  duration_minutes: number | null
  travel_minutes: number
  is_full_day: boolean
}): string {
  if (ev.is_full_day) return 'Full day'
  const start = parseDbTimeToMinutes(ev.start_time)
  if (start === null) return ''
  const total = blockTotalMinutes(ev)
  if (total <= 0) return formatMinutesLabel(start)
  const endMin = start + total
  return `${formatMinutesLabel(start)} – ${formatMinutesLabel(endMin)}`
}

function formatMinutesLabel(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
