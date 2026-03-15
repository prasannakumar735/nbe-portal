import type { PVCCalculationResponse } from '@/lib/types/pvc.types'

interface PVCQuoteSummaryProps {
  result: PVCCalculationResponse
  isSavingQuote: boolean
  onGenerateQuote: () => void
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function PVCQuoteSummary({ result, isSavingQuote, onGenerateQuote }: PVCQuoteSummaryProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Quote Summary</h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">Subtotal</dt>
          <dd className="font-semibold text-slate-900">{currency(result.totals.subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">Margin</dt>
          <dd className="font-semibold text-slate-900">{result.totals.marginPercent}%</dd>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <dt className="text-slate-800">Final Quote Price</dt>
          <dd className="text-xl font-bold text-indigo-600">{currency(result.totals.finalPrice)}</dd>
        </div>
      </dl>

      {result.quoteId ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Quote generated successfully. Quote ID: {result.quoteId}
        </div>
      ) : (
        <button
          type="button"
          onClick={onGenerateQuote}
          disabled={isSavingQuote}
          className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingQuote ? 'Generating Quote...' : 'Generate Quote'}
        </button>
      )}
    </section>
  )
}
