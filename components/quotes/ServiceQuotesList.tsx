'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { downloadServiceQuotePdf } from '@/components/quotes/downloadServiceQuotePdf'
import type { RapidDoorQuoteFormValues, ServiceQuoteFormValues } from '@/components/quotes/types'
import { downloadRapidDoorQuotePdf } from '@/components/quotes/downloadRapidDoorQuotePdf'
import { formatQuoteTaxonomyLine } from '@/lib/quotes/quoteTaxonomy'

type QuoteListRow = {
  id: string
  quote_number: string
  customer_name: string
  site_address: string
  service_date: string
  total: number
  created_at: string
  quote_kind?: string | null
  quote_type?: string | null
  quote_sub_category?: string | null
}

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

/** Saved quotes (all kinds: standard + industrial rapid door) + New Quote. */
function ServiceQuotesList() {
  const [q, setQ] = useState('')
  const [quotes, setQuotes] = useState<QuoteListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)

  const load = useCallback(async (search: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/quotes/service?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load quotes.')
      setQuotes(data.quotes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quotes.')
      setQuotes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load('')
  }, [load])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this quote? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/quotes/service/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed.')
      await load(q)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed.')
    }
  }

  const handleDownloadPdf = async (id: string) => {
    setPdfBusyId(id)
    try {
      const res = await fetch(`/api/quotes/service/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load quote.')
      const kind = data.quote?.quote_kind ?? 'service'
      const formValues = data.formValues as ServiceQuoteFormValues | RapidDoorQuoteFormValues
      if (kind === 'rapid_door') {
        await downloadRapidDoorQuotePdf(
          formValues as RapidDoorQuoteFormValues,
          `industrial-rapid-door-${(formValues as RapidDoorQuoteFormValues).quoteNumber}.pdf`,
        )
      } else {
        await downloadServiceQuotePdf(formValues as ServiceQuoteFormValues, `service-quote-${formValues.quoteNumber}.pdf`)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF download failed.')
    } finally {
      setPdfBusyId(null)
    }
  }

  return (
    <div className="w-full max-w-none space-y-6 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quote</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your saved quotes. Search by company name or quote number. Create a new quote anytime.
          </p>
        </div>
        <Link
          href="/dashboard/quotes/service/new"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New Quote
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
            placeholder="Company name or quote number…"
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

      {loading ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-slate-600">No saved quotes yet. Use New Quote to create one.</p>
      ) : (
        <>
          {/* Phones / tablets / small laptops: stacked cards — no horizontal page scroll */}
          <ul className="space-y-3 xl:hidden">
            {quotes.map(row => (
              <li
                key={row.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-slate-800">{row.quote_number}</p>
                    <p className="mt-1 font-medium text-slate-900">{row.customer_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">{currency.format(Number(row.total))}</p>
                    <p className="text-xs text-slate-500">{String(row.service_date).slice(0, 10)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-700">
                  {formatQuoteTaxonomyLine(row.quote_type ?? undefined, row.quote_sub_category ?? undefined)}
                </p>
                <p className="mt-2 break-words text-sm leading-snug text-slate-600">{row.site_address}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/quotes/service/${row.id}`}
                    className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    View
                  </Link>
                  <Link
                    href={`/dashboard/quotes/service/${row.id}/edit`}
                    className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(row.id)}
                    disabled={pdfBusyId === row.id}
                    className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {pdfBusyId === row.id ? 'PDF…' : 'PDF'}
                  </button>
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

          {/* Wide screens: full data table (may scroll inside this panel only if needed) */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm xl:block">
            <table className="w-full min-w-max table-auto border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Quote #</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Type</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Company</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Site</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Quote date</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Total</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-800">{row.quote_number}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                      {formatQuoteTaxonomyLine(row.quote_type ?? undefined, row.quote_sub_category ?? undefined)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-900">{row.customer_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600" title={row.site_address}>
                      {row.site_address}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{String(row.service_date).slice(0, 10)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {currency.format(Number(row.total))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-nowrap justify-end gap-2">
                        <Link
                          href={`/dashboard/quotes/service/${row.id}`}
                          className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          View
                        </Link>
                        <Link
                          href={`/dashboard/quotes/service/${row.id}/edit`}
                          className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(row.id)}
                          disabled={pdfBusyId === row.id}
                          className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                        >
                          {pdfBusyId === row.id ? 'PDF…' : 'PDF'}
                        </button>
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
      )}
    </div>
  )
}

export default ServiceQuotesList
