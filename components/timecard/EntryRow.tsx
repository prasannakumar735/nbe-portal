'use client'

import { Copy, Pencil, Trash2 } from 'lucide-react'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'

type Props = {
  entry: EmployeeTimesheetEntry
  clientName: string
  locationName: string
  readOnly: boolean
  onEdit: (entry: EmployeeTimesheetEntry) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

export function EntryRow({ entry, clientName, locationName, readOnly, onEdit, onDelete, onDuplicate }: Props) {
  const start = entry.start_time.slice(0, 5)
  const end = entry.end_time.slice(0, 5)

  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-slate-50/90 px-2.5 py-2 transition-colors hover:border-gray-200 hover:bg-white hover:shadow-sm"
      onClick={() => onEdit(entry)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit(entry)
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate font-semibold text-slate-900">{clientName}</span>
          {entry.billable ? (
            <span className="inline-flex shrink-0 items-center rounded-md border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              Billable
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-md border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Non-billable
            </span>
          )}
        </div>
        <p className="truncate text-xs text-slate-500">{locationName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
          <span className="tabular-nums font-medium">
            {start}–{end}
          </span>
          <span className="tabular-nums text-slate-700">{entry.total_hours.toFixed(2)}h</span>
        </div>
      </div>

      {!readOnly ? (
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button
            type="button"
            title="Duplicate"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={e => {
              e.stopPropagation()
              onDuplicate(entry.id)
            }}
          >
            <Copy className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            title="Edit"
            className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
            onClick={e => {
              e.stopPropagation()
              onEdit(entry)
            }}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            title="Delete"
            className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
            onClick={e => {
              e.stopPropagation()
              if (confirm('Delete this entry?')) onDelete(entry.id)
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  )
}
