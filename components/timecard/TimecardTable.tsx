'use client'

import { useMemo } from 'react'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import { buildDayEntries } from '@/components/timecards/groupWeekEntries'
import { TimecardDaySection } from '@/components/timecards/TimecardDaySection'

export type TimecardTableProps = {
  weekStartIso: string
  entries: EmployeeTimesheetEntry[]
  /** Total lines in the week (ignore filters). Defaults to entries.length when omitted. */
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

export function TimecardTable(props: TimecardTableProps) {
  const {
    weekStartIso,
    entries,
    totalWeekLines,
    readOnly,
    clientLabel,
    locationLabel,
    workTypeLabel,
    onAdd,
    onEdit,
    onDelete,
    onDuplicate,
  } = props

  const dayGroups = useMemo(
    () => buildDayEntries(weekStartIso, entries, clientLabel, locationLabel, workTypeLabel),
    [weekStartIso, entries, clientLabel, locationLabel, workTypeLabel],
  )

  const flatRows = useMemo(() => dayGroups.flatMap(d => d.items), [dayGroups])

  const lineCount = totalWeekLines ?? entries.length
  const weekEmpty = lineCount === 0
  const filtersHideAll = lineCount > 0 && entries.length === 0

  return (
    <div className="w-full min-w-0 space-y-4">
      {weekEmpty ? (
        <div
          className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600 sm:py-8"
          role="status"
        >
          <p className="font-medium text-slate-800">No entries for this week</p>
          <p className="mt-1 text-slate-500">
            Use <span className="font-medium text-slate-700">Add entry</span> on any day below, or &quot;Copy previous
            entry&quot; when you have a prior line.
          </p>
        </div>
      ) : null}

      {filtersHideAll ? (
        <div
          className="rounded-2xl border border-amber-200/90 bg-amber-50/80 px-4 py-4 text-center text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">No entries match the current filters.</p>
          <p className="mt-1 text-amber-900/80">Adjust filters or clear the client / billable / date range.</p>
        </div>
      ) : null}

      {/* Always render Mon–Sun; `buildDayEntries` groups by day even when there are zero entries */}
      <div
        className="w-full min-w-0 space-y-4"
        aria-label={`Weekly timesheet, ${flatRows.length} entr${flatRows.length === 1 ? 'y' : 'ies'}`}
      >
        {dayGroups.map(block => (
          <TimecardDaySection
            key={block.date}
            block={block}
            readOnly={readOnly}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
          />
        ))}
      </div>
    </div>
  )
}
