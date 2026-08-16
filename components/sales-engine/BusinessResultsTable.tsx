'use client'

import type { SalesBusiness } from '@/lib/sales/types/business.types'

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700',
  reviewed: 'bg-amber-100 text-amber-800',
  ignored: 'bg-slate-200 text-slate-600',
}

type BusinessResultsTableProps = {
  rows: SalesBusiness[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  updatingId: string | null
  onToggleSelected: (row: SalesBusiness, selected: boolean) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function BusinessResultsTable({
  rows,
  total,
  page,
  pageSize,
  loading,
  updatingId,
  onToggleSelected,
  onPageChange,
  onPageSizeChange,
}: BusinessResultsTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Results</h2>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <label htmlFor="sales-page-size">Per page</label>
          <select
            id="sales-page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="w-10 px-3 py-2" scope="col">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-3 py-2 font-medium text-slate-700">Company</th>
              <th className="px-3 py-2 font-medium text-slate-700">Address</th>
              <th className="px-3 py-2 font-medium text-slate-700">Website</th>
              <th className="px-3 py-2 font-medium text-slate-700">Phone</th>
              <th className="px-3 py-2 font-medium text-slate-700">Category</th>
              <th className="px-3 py-2 font-medium text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Loading businesses…
                </td>
              </tr>
            ) : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No businesses yet. Run a scan to discover prospects.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const address = [row.address, row.suburb, row.postcode].filter(Boolean).join(', ')
              return (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      disabled={updatingId === row.id}
                      onChange={(e) => onToggleSelected(row, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      aria-label={`Select ${row.company_name}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.company_name}</td>
                  <td className="px-3 py-2 text-slate-700">{address || '—'}</td>
                  <td className="px-3 py-2">
                    {row.website ? (
                      <a
                        href={row.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-700 underline"
                      >
                        {row.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.phone ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{row.category ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLES[row.status] ?? STATUS_STYLES.new
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-600">
        <p>
          Page {page} of {totalPages} · {total} total
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}
