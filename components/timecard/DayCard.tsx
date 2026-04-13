'use client'

import { Plus } from 'lucide-react'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import { EntryRow } from '@/components/timecard/EntryRow'

type Props = {
  /** Short day label, e.g. MON */
  dayName: string
  /** Localized date line, e.g. Apr 5 */
  dateDisplay: string
  dateIso: string
  entries: EmployeeTimesheetEntry[]
  dayTotalHours: number
  readOnly: boolean
  clientLabel: (clientId: string | null) => string
  locationLabel: (locationId: string | null) => string
  onAdd: (dateIso: string) => void
  onEdit: (entry: EmployeeTimesheetEntry) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

export function DayCard({
  dayName,
  dateDisplay,
  entries,
  dayTotalHours,
  readOnly,
  clientLabel,
  locationLabel,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate,
  dateIso,
}: Props) {
  return (
    <section
      className="flex min-h-[140px] w-full min-w-[220px] max-w-[260px] shrink-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <header className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dayName}</p>
          <p className="truncate text-sm font-semibold leading-tight text-slate-900">{dateDisplay}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-slate-800">{dayTotalHours.toFixed(2)}h</span>
          {!readOnly ? (
            <button
              type="button"
              title="Add entry"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-slate-50 text-indigo-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50"
              onClick={() => onAdd(dateIso)}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </header>

      <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-2">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">No entries</p>
        ) : (
          entries.map(e => (
            <EntryRow
              key={e.id}
              entry={e}
              clientName={clientLabel(e.client_id)}
              locationName={locationLabel(e.location_id)}
              readOnly={readOnly}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
            />
          ))
        )}
      </div>
    </section>
  )
}
