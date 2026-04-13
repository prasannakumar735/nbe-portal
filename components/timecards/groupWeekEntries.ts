import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import { dedupeTimesheetEntriesById } from '@/lib/timecard/dedupeTimesheetEntries'
import { weekDayLabels } from '@/lib/timecard/weekDates'
import type { DayEntry, TimeEntryRow } from '@/components/timecard/timecardTableTypes'

export function toTimeEntryRow(
  e: EmployeeTimesheetEntry,
  clientLabel: (id: string | null) => string,
  locationLabel: (id: string | null) => string,
  workTypeLabel: (l1: string | null, l2: string | null) => string,
): TimeEntryRow {
  return {
    id: e.id,
    clientName: clientLabel(e.client_id),
    locationName: locationLabel(e.location_id),
    workType: workTypeLabel(e.work_type_level1_id, e.work_type_level2_id),
    task: e.task ?? '',
    start: e.start_time.length > 5 ? e.start_time.slice(0, 5) : e.start_time,
    end: e.end_time.length > 5 ? e.end_time.slice(0, 5) : e.end_time,
    breakMinutes: e.break_minutes,
    hours: Number(e.total_hours) || 0,
    billable: e.billable,
    date: e.entry_date,
    sourceEntry: e,
  }
}

/** Group entries by calendar day (Mon–Sun). */
export function buildDayEntries(
  weekStartIso: string,
  entries: EmployeeTimesheetEntry[],
  clientLabel: (id: string | null) => string,
  locationLabel: (id: string | null) => string,
  workTypeLabel: (l1: string | null, l2: string | null) => string,
): DayEntry[] {
  const deduped = dedupeTimesheetEntriesById(entries)
  const days = weekDayLabels(weekStartIso)
  const byDate = new Map<string, EmployeeTimesheetEntry[]>()
  for (const e of deduped) {
    const list = byDate.get(e.entry_date) ?? []
    list.push(e)
    byDate.set(e.entry_date, list)
  }
  for (const [, list] of byDate) {
    list.sort((a, b) => a.sort_order - b.sort_order)
  }

  return days.map(d => {
    const raw = byDate.get(d.date) ?? []
    const items = raw.map(e => toTimeEntryRow(e, clientLabel, locationLabel, workTypeLabel))
    const dayTotalHours = items.reduce((s, r) => s + r.hours, 0)
    const datePretty = new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
    return {
      date: d.date,
      dayShort: d.label.toUpperCase().slice(0, 3),
      datePretty,
      dayTotalHours,
      items,
    }
  })
}
