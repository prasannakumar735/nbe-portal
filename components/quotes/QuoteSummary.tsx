type QuoteSummaryProps = {
  subtotal: number
  gst: number
  grandTotal: number
}

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export function QuoteSummary({ subtotal, gst, grandTotal }: QuoteSummaryProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Price Summary</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <dt className="text-slate-600">Subtotal</dt>
          <dd className="font-medium text-slate-900">{currency.format(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <dt className="text-slate-600">GST (10%)</dt>
          <dd className="font-medium text-slate-900">{currency.format(gst)}</dd>
        </div>
        <div className="flex items-center justify-between pt-1 text-base">
          <dt className="font-semibold text-slate-900">Grand Total</dt>
          <dd className="font-bold text-slate-900">{currency.format(grandTotal)}</dd>
        </div>
      </dl>
    </section>
  )
}
