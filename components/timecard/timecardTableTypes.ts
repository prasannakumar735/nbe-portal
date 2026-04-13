import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'

/** Display row for the timesheet table (denormalized from `EmployeeTimesheetEntry`). */
export type TimeEntry = {
  id: string
  clientName: string
  locationName: string
  workType: string
  task: string
  start: string
  end: string
  breakMinutes: number
  hours: number
  billable: boolean
  date: string
}

/** Flat row + reference to the persisted entry for modal / sync. */
export type TimeEntryRow = TimeEntry & {
  sourceEntry: EmployeeTimesheetEntry
}

/** One calendar day bucket after grouping source entries. */
export type DayEntry = {
  date: string
  dayShort: string
  datePretty: string
  dayTotalHours: number
  items: TimeEntryRow[]
}
