import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import { dedupeTimesheetEntriesById } from '@/lib/timecard/dedupeTimesheetEntries'

export type TimecardDayGroup = {
  date: string
  items: EmployeeTimesheetEntry[]
  /** Sum of `total_hours` for lines in this day. */
  totalHours: number
}

/**
 * Deduplicate by entry id, then group by `entry_date` (calendar day).
 * Days are sorted ascending. Lines within a day follow `sort_order`.
 */
export function groupTimecardsByDay(rows: EmployeeTimesheetEntry[]): TimecardDayGroup[] {
  const unique = dedupeTimesheetEntriesById(rows)
  const grouped = new Map<string, EmployeeTimesheetEntry[]>()
  for (const row of unique) {
    const key = row.entry_date.slice(0, 10)
    const list = grouped.get(key) ?? []
    list.push(row)
    grouped.set(key, list)
  }
  for (const [, list] of grouped) {
    list.sort((a, b) => a.sort_order - b.sort_order)
  }
  const dates = [...grouped.keys()].sort()
  return dates.map(date => {
    const items = grouped.get(date) ?? []
    const totalHours = items.reduce((s, r) => s + (Number(r.total_hours) || 0), 0)
    return { date, items, totalHours }
  })
}

export { dedupeTimesheetEntriesById, findDuplicateEntryIds } from './dedupeTimesheetEntries'
