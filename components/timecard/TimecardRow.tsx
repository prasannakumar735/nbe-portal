'use client'

import { memo } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import type { TimeEntryRow } from '@/components/timecard/timecardTableTypes'
import { TaskDetailInline, taskDetailSegments } from '@/components/timecards/taskDetailInline'

export type TimecardRowProps = {
  row: TimeEntryRow
  dayLabel: string
  striped: boolean
  readOnly: boolean
  onEdit: (entry: EmployeeTimesheetEntry) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

export const TimecardRow = memo(function TimecardRow({
  row,
  dayLabel,
  striped,
  readOnly,
  onEdit,
  onDelete,
  onDuplicate,
}: TimecardRowProps) {
  const { sourceEntry } = row
  const timeRange = `${row.start}–${row.end}`
  const segs = taskDetailSegments(row)

  return (
    <tr
      className={`cursor-pointer border-b border-slate-100/90 text-[13px] leading-snug transition-colors hover:bg-indigo-50/50 ${
        striped ? 'bg-white' : 'bg-slate-50/60'
      }`}
      onClick={() => onEdit(sourceEntry)}
    >
      <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold tracking-wide text-slate-600">{dayLabel}</td>
      <td className="max-w-[min(160px,18vw)] truncate px-3 py-3 font-medium text-slate-900" title={row.clientName}>
        {row.clientName}
      </td>
      <td className="max-w-[min(140px,16vw)] truncate px-3 py-3 text-sm text-slate-600" title={segs.location}>
        {segs.location}
      </td>
      <td className="max-w-[min(160px,18vw)] truncate px-3 py-3 text-sm text-slate-700" title={segs.workType}>
        {segs.workType}
      </td>
      <td className="max-w-[min(140px,16vw)] truncate px-3 py-3 text-sm text-slate-600" title={segs.task}>
        {segs.task}
      </td>
      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-800">{timeRange}</td>
      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">{row.breakMinutes}</td>
      <td className="whitespace-nowrap px-3 py-3 tabular-nums font-semibold text-slate-900">{row.hours.toFixed(2)}</td>
      <td className="px-3 py-3">
        {row.billable ? (
          <span className="inline-flex rounded-md border border-emerald-200/90 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
            Billable
          </span>
        ) : (
          <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Non-billable
          </span>
        )}
      </td>
      <td className="px-2 py-2.5 text-right" onClick={e => e.stopPropagation()}>
        {!readOnly ? (
          <div className="inline-flex items-center gap-0.5">
            <button
              type="button"
              title="Duplicate"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={() => onDuplicate(sourceEntry.id)}
            >
              <Copy className="size-4 shrink-0" aria-hidden />
            </button>
            <button
              type="button"
              title="Edit"
              className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
              onClick={() => onEdit(sourceEntry)}
            >
              <Pencil className="size-4 shrink-0" aria-hidden />
            </button>
            <button
              type="button"
              title="Delete"
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                if (confirm('Delete this entry?')) onDelete(sourceEntry.id)
              }}
            >
              <Trash2 className="size-4 shrink-0" aria-hidden />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
    </tr>
  )
})

export type TimecardMobileCardProps = Omit<TimecardRowProps, 'dayLabel'> & { dayHeading: string }

export const TimecardMobileCard = memo(function TimecardMobileCard({
  row,
  striped,
  readOnly,
  dayHeading,
  onEdit,
  onDelete,
  onDuplicate,
}: TimecardMobileCardProps) {
  const { sourceEntry } = row

  return (
    <div
      role="button"
      tabIndex={0}
      className={`rounded-xl border border-slate-200/90 p-4 shadow-sm outline-none ring-slate-200/60 transition-all hover:border-indigo-200/80 hover:ring-1 ${
        striped ? 'bg-white' : 'bg-slate-50/80'
      }`}
      onClick={() => onEdit(sourceEntry)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit(sourceEntry)
        }
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dayHeading}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold text-slate-900">{row.clientName}</p>
          <TaskDetailInline row={row} />
        </div>
        {row.billable ? (
          <span className="shrink-0 rounded-md border border-emerald-200/90 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-900">
            Billable
          </span>
        ) : (
          <span className="shrink-0 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
            Non-billable
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <span className="tabular-nums font-medium text-slate-800">
          {row.start}–{row.end}
        </span>
        <span>Break {row.breakMinutes} min</span>
        <span className="font-semibold tabular-nums text-slate-900">{row.hours.toFixed(2)} h</span>
      </div>
      {!readOnly ? (
        <div className="mt-3 flex justify-end gap-0.5" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            title="Duplicate"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => onDuplicate(sourceEntry.id)}
          >
            <Copy className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            title="Edit"
            className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
            onClick={() => onEdit(sourceEntry)}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            title="Delete"
            className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              if (confirm('Delete this entry?')) onDelete(sourceEntry.id)
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  )
})
