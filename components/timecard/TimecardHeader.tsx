'use client'

import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import type { EmployeeTimesheetStatus, TimecardSaveStatus } from '@/lib/types/employee-timesheet.types'
import { StatusBadge } from '@/components/timecard/StatusBadge'

function syncPillClass(saveStatus: TimecardSaveStatus): string {
  switch (saveStatus) {
    case 'saving':
      return 'border-slate-200 bg-slate-50 text-slate-700'
    case 'saved_offline':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'synced':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    case 'error':
      return 'border-red-200 bg-red-50 text-red-800'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function syncLabel(saveStatus: TimecardSaveStatus): string {
  switch (saveStatus) {
    case 'saving':
      return 'Saving…'
    case 'saved_offline':
      return 'Saved offline'
    case 'synced':
      return 'Synced'
    case 'error':
      return 'Save error'
    default:
      return 'Ready'
  }
}

type Props = {
  title?: string
  subtitle: string
  timesheetStatus: EmployeeTimesheetStatus
  saveStatus: TimecardSaveStatus
  onPrevWeek: () => void
  onNextWeek: () => void
  onExportCsv: () => void
  onSubmitWeek: () => void | Promise<void>
  submitDisabled: boolean
  readOnly: boolean
}

export function TimecardHeader({
  title = 'Timecard',
  subtitle,
  timesheetStatus,
  saveStatus,
  onPrevWeek,
  onNextWeek,
  onExportCsv,
  onSubmitWeek,
  submitDisabled,
  readOnly,
}: Props) {
  return (
    <header className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
            <StatusBadge status={timesheetStatus} />
          </div>
          <p className="text-sm text-slate-600">{subtitle}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${syncPillClass(saveStatus)}`}
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              ) : null}
              {syncLabel(saveStatus)}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            onClick={onPrevWeek}
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden />
            Previous
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            onClick={onNextWeek}
          >
            Next
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            onClick={onExportCsv}
          >
            <Download className="size-4 shrink-0" aria-hidden />
            Export CSV
          </button>
          {!readOnly ? (
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitDisabled}
              onClick={() => void onSubmitWeek()}
            >
              Submit week
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
