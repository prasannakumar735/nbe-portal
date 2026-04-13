'use client'

import { Download, FileText, RefreshCw } from 'lucide-react'
import { ReportsOfflineNote } from '@/components/reports/ReportsOfflineNote'

type Props = {
  onExportCsv: () => void
  onExportPdf: () => void
  onRefresh: () => void
  refreshing?: boolean
}

export function ReportsHeader({ onExportCsv, onExportPdf, onRefresh, refreshing }: Props) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Analytics</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Reports &amp; Analytics</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            Centralised insights across operations, time tracking, maintenance, GPS activity, and revenue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="size-4 shrink-0" aria-hidden />
            Export CSV
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <FileText className="size-4 shrink-0" aria-hidden />
            Export PDF
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`size-4 shrink-0 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>
      <ReportsOfflineNote />
    </header>
  )
}
