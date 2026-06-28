'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import {
  invoiceStatusLabel,
  workflowStatusLabel,
} from '@/lib/pvc/pvcQuoteWorkflow'

type PvcQuoteListRow = {
  id: string
  customer_name: string | null
  ref_no: string | null
  site_address: string | null
  total_price: number | null
  status: string | null
  workflow_status: string | null
  invoice_status: string | null
  quote_label: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

function listWorkflowLabel(row: PvcQuoteListRow): string {
  const wf = workflowStatusLabel(row.workflow_status)
  if (row.workflow_status === 'shipped_or_installed' && row.invoice_status) {
    return `${wf} · ${invoiceStatusLabel(row.invoice_status)}`
  }
  return wf
}

export function PVCQuotesList({
  embedded = false,
  refreshToken = 0,
}: {
  embedded?: boolean
  /** Increment to refetch the list (e.g. after save on calculator page). */
  refreshToken?: number
}) {
  const [q, setQ] = useState('')
  const [quotes, setQuotes] = useState<PvcQuoteListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (search: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/pvc/quotes?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load PVC quotes.')
      setQuotes(data.quotes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PVC quotes.')
      setQuotes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken triggers refetch only
  }, [load, refreshToken])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this PVC quote? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/pvc/quotes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed.')
      await load(q)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed.')
    }
  }

  const listContent =
    loading ? (
      <p className="text-sm text-slate-600">Loading…</p>
    ) : quotes.length === 0 ? (
      <p className="text-sm text-slate-600">No saved PVC quotes yet.</p>
    ) : (
      <>
        <ul className="space-y-3 xl:hidden">
          {quotes.map(row => (
            <li key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-indigo-700">PVC Strip</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {row.quote_label || row.customer_name || 'PVC quote'}
                  </p>
                  {row.ref_no ? <p className="mt-0.5 font-mono text-xs text-slate-600">Ref {row.ref_no}</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {currency.format(Number(row.total_price) || 0)}
                  </p>
                  <p className="text-xs text-slate-500">{listWorkflowLabel(row)}</p>
                </div>
              </div>
              {row.site_address ? (
                <p className="mt-2 break-words text-sm leading-snug text-slate-600">{row.site_address}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Updated {String(row.updated_at ?? row.created_at).slice(0, 10)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/pvc-calculator/${row.id}/edit`}
                  className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Edit
                </Link>
                {row.pdf_url && row.pdf_url !== 'local-download' ? (
                  <a
                    href={row.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                  >
                    PDF
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm xl:block">
          <table className="w-full min-w-max table-auto border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Label</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Customer</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Ref</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Status</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Updated</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">Total</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-800" title={row.quote_label ?? ''}>
                    {row.quote_label || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-900">{row.customer_name || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">{row.ref_no || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{listWorkflowLabel(row)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {String(row.updated_at ?? row.created_at).slice(0, 10)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {currency.format(Number(row.total_price) || 0)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-nowrap justify-end gap-2">
                      <Link
                        href={`/pvc-calculator/${row.id}/edit`}
                        className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                      {row.pdf_url && row.pdf_url !== 'local-download' ? (
                        <a
                          href={row.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                        >
                          PDF
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )

  if (embedded) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Saved PVC strip quotes</h2>
          <p className="mt-1 text-sm text-slate-600">
            Drafts and finalized calculator quotes. Search by customer or reference.
          </p>
        </div>

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={e => {
            e.preventDefault()
            load(q)
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-slate-700 sm:min-w-[200px]">
            Search
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Customer or reference…"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Apply
          </button>
        </form>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}
        {listContent}
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-6 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PVC Strip Calculator</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your saved PVC strip quotes. Search by customer or reference. Start a new quote anytime.
          </p>
        </div>
        <Link
          href="/pvc-calculator/new"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New quote
        </Link>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={e => {
          e.preventDefault()
          load(q)
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-slate-700 sm:min-w-[200px]">
          Search
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Customer or reference…"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Apply
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {listContent}
    </div>
  )
}

export default PVCQuotesList
