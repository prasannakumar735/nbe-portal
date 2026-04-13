'use client'

import { CalendarRange } from 'lucide-react'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import { TimecardTable } from '@/components/timecard/TimecardTable'

type Props = {
  weekStartIso: string
  entries: EmployeeTimesheetEntry[]
  /** Lines in the week before UI filters (for empty vs filter-empty messaging). */
  totalWeekLines?: number
  readOnly: boolean
  clientLabel: (clientId: string | null) => string
  locationLabel: (locationId: string | null) => string
  workTypeLabel: (level1Id: string | null, level2Id: string | null) => string
  onAdd: (dateIso: string) => void
  onEdit: (entry: EmployeeTimesheetEntry) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

export function WeekView(props: Props) {
  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm sm:items-center sm:p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200/80">
          <CalendarRange className="size-[18px] text-slate-500" aria-hidden />
        </div>
        <p className="min-w-0 text-sm leading-snug text-slate-600">
          <span className="font-medium text-slate-800">Tip:</span> use{' '}
          <span className="font-medium text-slate-700">Add entry</span> per day or{' '}
          <span className="font-medium text-slate-700">Copy previous entry</span>. Edit lines with{' '}
          <span className="font-medium text-slate-700">Edit</span> on each card.
        </p>
      </div>

      <TimecardTable {...props} />
    </div>
  )
}
