'use client'

import type { RapidDoorQuoteFormValues } from '@/components/quotes/types'
import { formatQuoteTaxonomyLine } from '@/lib/quotes/quoteTaxonomy'
import { computeServiceQuoteTotals } from '@/lib/quotes/serviceQuoteSnapshot'

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

type Props = {
  values: RapidDoorQuoteFormValues
}

/** Read-only layout for industrial rapid door quotes (used on unified quote view page). */
export function QuoteReadOnlyIndustrialRapidDoor({ values }: Props) {
  const { subtotal, gst, grandTotal } = computeServiceQuoteTotals(values)

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Industrial Rapid Door (read-only)</h1>
        <p className="mt-1 font-mono text-sm text-slate-600">{values.quoteNumber}</p>
        <p className="mt-2 text-sm text-slate-700">{formatQuoteTaxonomyLine(values.quoteType, values.quoteSubCategory)}</p>
        <p className="mt-1 text-sm text-slate-600">Valid until {values.validUntil}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
            <dt className="text-slate-500">Sales contact</dt>
            <dd>
              {values.salesContactName} · {values.salesContactPhone}
              <br />
              {values.salesContactEmail}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Customer</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Attn</dt>
            <dd>{values.attn || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Company</dt>
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
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Site address</dt>
            <dd>{values.siteAddress || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd>{values.customerEmail || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Quote date</dt>
            <dd>{values.serviceDate}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Schedule</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse border border-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-2 py-2 text-left">#</th>
                <th className="border border-slate-200 px-2 py-2 text-left">Item</th>
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
                  <td className="border border-slate-200 px-2 py-2 whitespace-pre-wrap">{item.itemTitle || '—'}</td>
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
            <span>Total</span>
            <span>{currency.format(grandTotal)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Schedule A</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{values.scheduleANotes || '—'}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Scope (PDF)</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{values.introNote}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Signature</h2>
        <p className="mt-2 text-sm text-slate-700">Printed name: {values.printedName || '—'}</p>
        <p className="text-sm text-slate-700">Date: {values.signatureDate || '—'}</p>
      </section>
    </>
  )
}
