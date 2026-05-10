'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { downloadServiceQuotePdf } from '@/components/quotes/downloadServiceQuotePdf'
import { downloadRapidDoorQuotePdf } from '@/components/quotes/downloadRapidDoorQuotePdf'
import { QuoteReadOnlyIndustrialRapidDoor } from '@/components/quotes/QuoteReadOnlyIndustrialRapidDoor'
import type { RapidDoorQuoteFormValues, ServiceQuoteFormValues } from '@/components/quotes/types'
import { computeServiceQuoteTotals } from '@/lib/quotes/serviceQuoteSnapshot'
import { formatQuoteTaxonomyLine } from '@/lib/quotes/quoteTaxonomy'

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

type Loaded =
  | { kind: 'service'; values: ServiceQuoteFormValues }
  | { kind: 'rapid_door'; values: RapidDoorQuoteFormValues }

export default function ViewQuotePage() {
  const params = useParams()
  const router = useRouter()
  const quoteId = String(params.quoteId ?? '')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const r = await fetch(`/api/quotes/service/${quoteId}`)
        const data = await r.json()
        if (!r.ok) {
          setErr(data.error || 'Failed to load quote.')
          return
        }
        if (cancel) return
        if (data.quote?.quote_kind === 'rapid_door') {
          setLoaded({ kind: 'rapid_door', values: data.formValues as RapidDoorQuoteFormValues })
        } else {
          setLoaded({ kind: 'service', values: data.formValues as ServiceQuoteFormValues })
        }
      } catch {
        if (!cancel) setErr('Failed to load quote.')
      }
    })()
    return () => {
      cancel = true
    }
  }, [quoteId])

  const handleDelete = async () => {
    if (!window.confirm('Delete this quote? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/quotes/service/${quoteId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed.')
      router.push('/dashboard/quotes/service')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed.')
    }
  }

  const handlePdf = async () => {
    if (!loaded) return
    setPdfBusy(true)
    try {
      if (loaded.kind === 'rapid_door') {
        await downloadRapidDoorQuotePdf(loaded.values, `industrial-rapid-door-${loaded.values.quoteNumber}.pdf`)
      } else {
        await downloadServiceQuotePdf(loaded.values, `service-quote-${loaded.values.quoteNumber}.pdf`)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF failed.')
    } finally {
      setPdfBusy(false)
    }
  }

  if (err) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-red-600">{err}</p>
        <Link href="/dashboard/quotes/service" className="mt-4 inline-block text-sm text-slate-700 underline">
          Back to quotes
        </Link>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 py-4 sm:space-y-6 sm:py-6 lg:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/quotes/service" className="text-sm font-medium text-slate-700 underline">
          ← Quote
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/quotes/service/${quoteId}/edit`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handlePdf}
            disabled={pdfBusy}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {loaded.kind === 'rapid_door' ? (
        <QuoteReadOnlyIndustrialRapidDoor values={loaded.values} />
      ) : (
        <ServiceQuoteReadOnlyBody values={loaded.values} />
      )}
    </div>
  )
}

function ServiceQuoteReadOnlyBody({ values }: { values: ServiceQuoteFormValues }) {
  const { subtotal, gst, grandTotal } = computeServiceQuoteTotals(values)

  return (
    <>
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold text-slate-900">Quote (read-only)</h1>
        <p className="mt-1 font-mono text-sm text-slate-600">{values.quoteNumber}</p>
        <p className="mt-2 text-sm text-slate-700">{formatQuoteTaxonomyLine(values.quoteType, values.quoteSubCategory)}</p>
      </div>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Supplier</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Company</dt>
            <dd className="font-medium text-slate-900">{values.companyName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">ABN</dt>
            <dd>{values.abn}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Address</dt>
            <dd>{values.companyAddress}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Email</dt>
            <dd>{values.companyEmail}</dd>
          </div>
        </dl>
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Customer</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Company name</dt>
            <dd className="font-medium text-slate-900">{values.customerCompany || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Contact</dt>
            <dd>{values.contactPerson || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd>{values.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd>{values.customerEmail || '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Site address</dt>
            <dd>{values.siteAddress || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Quote date</dt>
            <dd>{values.serviceDate}</dd>
          </div>
        </dl>
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Line items</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse border border-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-2 text-left">#</th>
                <th className="border border-slate-200 px-2 py-2 text-left">Description</th>
                <th className="border border-slate-200 px-2 py-2 text-left">Qty</th>
                <th className="border border-slate-200 px-2 py-2 text-left">Unit</th>
                <th className="border border-slate-200 px-2 py-2 text-left">Line total</th>
              </tr>
            </thead>
            <tbody>
              {values.items.map((item, i) => (
                <tr key={i}>
                  <td className="border border-slate-200 px-2 py-2">{i + 1}</td>
                  <td className="border border-slate-200 px-2 py-2 whitespace-pre-wrap">{item.description}</td>
                  <td className="border border-slate-200 px-2 py-2">{item.qty}</td>
                  <td className="border border-slate-200 px-2 py-2">{currency.format(Number(item.unitPrice || 0))}</td>
                  <td className="border border-slate-200 px-2 py-2">
                    {currency.format(Number(item.qty || 0) * Number(item.unitPrice || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between border-b border-slate-200 py-1">
            <span className="text-slate-600">Subtotal</span>
            <span>{currency.format(subtotal)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1">
            <span className="text-slate-600">GST (10%)</span>
            <span>{currency.format(gst)}</span>
          </div>
          <div className="flex justify-between pt-1 font-semibold text-slate-900">
            <span>Grand total</span>
            <span>{currency.format(grandTotal)}</span>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Notes</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{values.notes}</p>
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Signature</h2>
        <p className="mt-2 text-sm text-slate-700">Name: {values.printedName || '—'}</p>
        <p className="text-sm text-slate-700">Date: {values.signatureDate || '—'}</p>
      </section>
    </>
  )
}
