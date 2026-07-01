'use client'

import { BadgeDollarSign, Clock, ListChecks, Palmtree, TrendingUp } from 'lucide-react'
import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'
import { isLeaveTimesheetEntry, splitWorkAndLeaveHours } from '@/lib/timecard/leaveWorkType'

type Props = {
  entries: EmployeeTimesheetEntry[]
  l1CodeById: Map<string, string>
  /** Optional prior-week total hours for a simple trend hint (all hours incl. leave) */
  previousWeekTotalHours?: number | null
}

function fmt(n: number) {
  return n.toFixed(2)
}

export function TimecardSummary({ entries, l1CodeById, previousWeekTotalHours }: Props) {
  const count = entries.length
  const split = splitWorkAndLeaveHours(
    entries,
    e => isLeaveTimesheetEntry(e, l1CodeById),
    e => Number(e.total_hours) || 0,
  )
  const billable = entries.filter(e => e.billable).reduce((s, e) => s + (Number(e.total_hours) || 0), 0)

  const delta =
    previousWeekTotalHours != null && Number.isFinite(previousWeekTotalHours)
      ? split.totalHours - previousWeekTotalHours
      : null

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <ListChecks className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Entries</p>
          <p className="text-xl font-semibold tabular-nums text-slate-900">{count}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Clock className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Work hours</p>
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-xl font-semibold tabular-nums text-slate-900">{fmt(split.workHours)}</p>
            {delta != null ? (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${
                  delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                <TrendingUp className={`size-3.5 ${delta < 0 ? 'rotate-180' : ''}`} aria-hidden />
                {delta >= 0 ? '+' : ''}
                {fmt(delta)} vs last week
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">Total incl. leave {fmt(split.totalHours)} h</p>
        </div>
      </div>

      {split.leaveHours > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <Palmtree className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Leave hours</p>
            <p className="text-xl font-semibold tabular-nums text-rose-900">{fmt(split.leaveHours)}</p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <BadgeDollarSign className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Billable hours</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-800">{fmt(billable)}</p>
        </div>
      </div>
    </div>
  )
}
