'use client'

import { memo } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import type { TimeEntryRow } from '@/components/timecard/timecardTableTypes'
import { TaskDetailInline } from '@/components/timecards/taskDetailInline'

export type TimeEntryCardProps = {
  row: TimeEntryRow
  readOnly: boolean
  onEdit: (entry: EmployeeTimesheetEntry) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

function formatHoursTotal(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function breakLabel(minutes: number): string {
  if (minutes <= 0) return '0m'
  if (minutes % 60 === 0) return `${minutes / 60}h`
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const iconBtn =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'

const iconBtnDanger =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:bg-red-50 hover:text-red-700'

export const TimeEntryCard = memo(function TimeEntryCard({
  row,
  readOnly,
  onEdit,
  onDelete,
  onDuplicate,
}: TimeEntryCardProps) {
  const { sourceEntry } = row
  const timeRange = `${row.start} → ${row.end}`

  const metrics = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums text-slate-700">
      <span className="text-slate-800">{timeRange}</span>
      <span className="text-slate-300" aria-hidden>
        ·
      </span>
      <span className="text-slate-600">Break {breakLabel(row.breakMinutes)}</span>
      <span className="text-slate-300" aria-hidden>
        ·
      </span>
      <span className="font-semibold text-slate-900">{formatHoursTotal(row.hours)}h</span>
    </div>
  )

  const actions = !readOnly ? (
    <div
      className="flex shrink-0 items-center gap-1"
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <button type="button" title="Edit entry" className={iconBtn} onClick={() => onEdit(sourceEntry)}>
        <Pencil className="size-3.5" aria-hidden />
        <span className="sr-only">Edit</span>
      </button>
      <button type="button" title="Duplicate entry" className={iconBtn} onClick={() => onDuplicate(sourceEntry.id)}>
        <Copy className="size-3.5" aria-hidden />
        <span className="sr-only">Duplicate</span>
      </button>
      <button
        type="button"
        title="Delete entry"
        className={iconBtnDanger}
        onClick={() => {
          if (confirm('Delete this entry?')) onDelete(sourceEntry.id)
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
        <span className="sr-only">Delete</span>
      </button>
    </div>
  ) : null

  return (
    <article className="min-w-0 rounded-lg border border-slate-200/90 bg-white p-3 text-sm shadow-sm ring-1 ring-slate-900/[0.03] transition hover:border-slate-300 hover:ring-slate-900/[0.06]">
      {/* Desktop: one row · Mobile: row 1 = identity, row 2 = metrics + actions */}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-slate-900" title={row.clientName}>
              {row.clientName}
            </span>
            {row.billable ? (
              <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200/80">
                Billable
              </span>
            ) : (
              <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80">
                Non-billable
              </span>
            )}
          </div>
          <div className="min-w-0 max-w-full">
            <TaskDetailInline row={row} />
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:max-w-[min(100%,24rem)] sm:justify-end sm:gap-3">
          {metrics}
          {actions}
        </div>
      </div>
    </article>
  )
})
