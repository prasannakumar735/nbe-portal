import { BASE_LOCATION } from '@/lib/constants'
import { getDrivingMinutesOneWay, getTravelTime } from '@/lib/travel'
import type { CalendarEventRow } from '@/lib/calendar/types'
import { parseDbTimeToMinutes } from '@/lib/calendar/duration'

/**
 * Same calendar day + same assignee, timed events only (excludes `excludeId`).
 * Finds the job whose block ends latest but still before `currentStartMin`.
 */
export function findPreviousJobEndingBefore(
  dayEvents: CalendarEventRow[],
  excludeId: string,
  currentStartMin: number
): CalendarEventRow | null {
  let best: CalendarEventRow | null = null
  let bestEnd = -1
  for (const ev of dayEvents) {
    if (ev.id === excludeId || ev.is_full_day || !ev.start_time) continue
    const end = parseDbTimeToMinutes(ev.end_time)
    if (end === null) continue
    if (end <= currentStartMin && end > bestEnd) {
      bestEnd = end
      best = ev
    }
  }
  return best
}

/**
 * Travel minutes for a timed job:
 * - If a previous job on the same day/route has coordinates → one-way drive from previous → current.
 * - Otherwise → round-trip from factory (existing field-service behaviour).
 */
export async function computeSmartTravelMinutes(
  current: Pick<CalendarEventRow, 'location_lat' | 'location_lng'>,
  sameAssigneeDayEvents: CalendarEventRow[],
  selfId: string,
  selfStartMin: number
): Promise<number> {
  const lat = current.location_lat
  const lng = current.location_lng
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 0
  }
  const dest = { lat, lng }

  const prev = findPreviousJobEndingBefore(sameAssigneeDayEvents, selfId, selfStartMin)
  if (
    prev &&
    prev.location_lat != null &&
    prev.location_lng != null &&
    Number.isFinite(prev.location_lat) &&
    Number.isFinite(prev.location_lng)
  ) {
    return getDrivingMinutesOneWay(
      { lat: prev.location_lat, lng: prev.location_lng },
      dest
    )
  }

  return getTravelTime(BASE_LOCATION, dest)
}
