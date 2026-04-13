'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

export type ReportColumn<T> = {
  id: string
  header: string
  accessor: (row: T) => string | number | boolean
  /** When set, rendered instead of stringified accessor (sort still uses accessor) */
  render?: (row: T) => ReactNode
  /** Tailwind for th/td */
  className?: string
  /** Right-align numeric values */
  numeric?: boolean
  /** Optional: truncate long text */
  truncate?: boolean
}

type SortDir = 'asc' | 'desc'

function cmp(a: string | number | boolean, b: string | number | boolean): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

export function ReportDataTable<T extends { id: string }>({
  rows,
  columns,
  emptyMessage = 'No rows for the selected filters.',
}: {
  rows: T[]
  columns: ReportColumn<T>[]
  emptyMessage?: string
}) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => {
    if (!sortCol) return rows
    const col = columns.find(c => c.id === sortCol)
    if (!col) return rows
    const next = [...rows].sort((a, b) => {
      const va = col.accessor(a)
      const vb = col.accessor(b)
      return sortDir === 'asc' ? cmp(va, vb) : -cmp(va, vb)
    })
    return next
  }, [rows, columns, sortCol, sortDir])

  const toggleSort = (id: string) => {
    if (sortCol !== id) {
      setSortCol(id)
      setSortDir('asc')
      return
    }
    setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
  }

  const SortIcon = ({ id }: { id: string }) => {
    if (sortCol !== id) return <ChevronsUpDown className="size-3.5 text-slate-400" aria-hidden />
    return sortDir === 'asc' ? (
      <ArrowUp className="size-3.5 text-indigo-600" aria-hidden />
    ) : (
      <ArrowDown className="size-3.5 text-indigo-600" aria-hidden />
    )
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.04]">
      <div className="max-h-[min(70vh,720px)] overflow-y-auto overflow-x-hidden">
        <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur">
            <tr>
              {columns.map(c => (
                <th
                  key={c.id}
                  className={`whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700 ${c.numeric ? 'text-right' : ''} ${c.className ?? ''}`}
                >
                  <button
                    type="button"
                    className={`inline-flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-slate-100 ${c.numeric ? 'justify-end' : 'text-left'}`}
                    onClick={() => toggleSort(c.id)}
                  >
                    {c.header}
                    <SortIcon id={c.id} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map(row => (
                <tr
                  key={row.id}
                  className="border-b border-slate-50/80 bg-white transition-colors hover:bg-slate-50/90"
                >
                  {columns.map(c => {
                    const raw = c.accessor(row)
                    const text = typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : raw
                    return (
                      <td
                        key={c.id}
                        className={`px-3 py-2.5 align-middle text-slate-800 ${c.numeric ? 'text-right tabular-nums' : ''} ${c.truncate ? 'max-w-[14rem] truncate' : ''} ${c.className ?? ''}`}
                        title={c.truncate && !c.render ? String(text) : undefined}
                      >
                        {c.render ? c.render(row) : String(text)}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
