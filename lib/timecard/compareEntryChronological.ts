import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'

function minutesSinceMidnight(startTime: string): number {
  const t = (startTime ?? '').trim().slice(0, 5)
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return 0
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return 0
  return h * 60 + min
}

/** Sort by calendar day, then start time, then stored order (stable tie-break). */
export function compareEntryChronological(a: EmployeeTimesheetEntry, b: EmployeeTimesheetEntry): number {
  const dc = a.entry_date.slice(0, 10).localeCompare(b.entry_date.slice(0, 10))
  if (dc !== 0) return dc
  const ta = minutesSinceMidnight(a.start_time)
  const tb = minutesSinceMidnight(b.start_time)
  if (ta !== tb) return ta - tb
  return a.sort_order - b.sort_order
}
