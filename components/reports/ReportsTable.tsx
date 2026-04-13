'use client'

import { ReportDataTable, type ReportColumn } from '@/components/reports/ReportDataTable'

type Props<T extends { id: string }> = {
  columns: ReportColumn<T>[]
  rows: T[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  emptyMessage?: string
  page: number
  pageSize: number
  totalRows: number
  onPageChange: (page: number) => void
}

export function ReportsTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyMessage = 'No data found for selected filters',
  page,
  pageSize,
  totalRows,
  onPageChange,
}: Props<T>) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.04]">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur">
              <tr>
                {columns.map(c => (
                  <th key={c.id} className="whitespace-nowrap px-2 py-2.5 font-semibold text-slate-700">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map(c => (
                    <td key={c.id} className="px-2 py-2">
                      <div className="h-3 rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200/90 bg-red-50/90 px-4 py-6 text-center shadow-sm">
        <p className="text-sm font-medium text-red-800">Unable to load data</p>
        <p className="mt-1 text-xs text-red-700/90">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-9 items-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-12 text-center text-sm text-slate-600 shadow-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ReportDataTable rows={rows} columns={columns} emptyMessage={emptyMessage} />
      {totalRows > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <p>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)} of {totalRows}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
