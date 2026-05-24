import type { CalendarEventRow, EventAssignee } from '@/lib/calendar/types'

/** Ordered unique IDs for overlap + display (prefer join-table assignees when present). */
export function calendarEventAssigneeIds(ev: CalendarEventRow): string[] {
  const fromJoin =
    Array.isArray(ev.assignees) && ev.assignees.length > 0
      ? ev.assignees.map(a => String(a?.id ?? '').trim()).filter(Boolean)
      : []
  if (fromJoin.length > 0) {
    const seen = new Set<string>()
    const out: string[] = []
    for (const id of fromJoin) {
      if (seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
    return out
  }
  const p = String(ev.assigned_to ?? '').trim()
  return p ? [p] : []
}

export function calendarEventAssigneeLabels(
  ev: CalendarEventRow,
  resolveName: (id: string) => string
): string[] {
  return calendarEventAssigneeIds(ev).map(resolveName)
}

export function mergeAssigneeProfilesIntoEvents(
  events: CalendarEventRow[],
  rows: Array<{ event_id: string; user_id: string }>,
  profileFallback: Record<string, string | null>
): CalendarEventRow[] {
  type Small = Pick<EventAssignee, 'id' | 'full_name'>
  const grouped = new Map<string, Small[]>()

  const push = (eid: string, userId: string) => {
    const list = grouped.get(eid) ?? []
    if (list.some(x => x.id === userId)) return
    const raw = profileFallback[userId]
    const full_name = raw != null && String(raw).trim() !== '' ? String(raw).trim() : null
    list.push({ id: userId, full_name })
    grouped.set(eid, list)
  }

  for (const r of rows) {
    const eid = String(r.event_id ?? '').trim()
    const uid = String(r.user_id ?? '').trim()
    if (!eid || !uid) continue
    push(eid, uid)
  }

  /** Keep legacy primary first, then stable order for coworkers. */
  const sortAssignees = (ev: CalendarEventRow, list: Small[]): Small[] =>
    [...list].sort((a, b) => {
      if (a.id === ev.assigned_to) return -1
      if (b.id === ev.assigned_to) return 1
      return a.id.localeCompare(b.id)
    })

  return events.map(ev => {
    const list = grouped.get(ev.id)
    if (!list?.length) return ev
    return { ...ev, assignees: sortAssignees(ev, list) }
  })
}
