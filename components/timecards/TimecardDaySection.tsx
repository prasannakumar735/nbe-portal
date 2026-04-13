'use client'

import { memo } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import type { DayEntry } from '@/components/timecard/timecardTableTypes'
import { TimeEntryCard } from '@/components/timecards/TimeEntryCard'

export type TimecardDaySectionProps = {
  block: DayEntry
  readOnly: boolean
  onAdd: (dateIso: string) => void
  onEdit: (entry: EmployeeTimesheetEntry) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

export const TimecardDaySection = memo(function TimecardDaySection({
  block,
  readOnly,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate,
}: TimecardDaySectionProps) {
  const heading = `${block.dayShort} · ${block.datePretty}`

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {block.dayTotalHours.toFixed(2)} h total
          </p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-indigo-200/80 bg-indigo-50 px-3 text-sm font-medium text-indigo-800 shadow-sm transition hover:bg-indigo-100 sm:self-auto"
            onClick={() => onAdd(block.date)}
          >
            <Plus className="size-4" aria-hidden />
            Add entry
          </button>
        ) : null}
      </div>

      {block.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
            <CalendarDays className="size-5 text-slate-400" aria-hidden />
          </div>
          <p className="text-sm font-medium text-slate-700">No entries for this day</p>
          {!readOnly ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              onClick={() => onAdd(block.date)}
            >
              <Plus className="size-4" aria-hidden />
              Add entry
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          {block.items.map((row, index) => (
            <TimeEntryCard
              key={`${row.date}-${row.id}-${index}`}
              row={row}
              readOnly={readOnly}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
            />
          ))}
        </div>
      )}
    </section>
  )
})
