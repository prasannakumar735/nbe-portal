import type { PVCCalculationResponse } from '@/lib/types/pvc.types'

interface PVCResultsProps {
  result: PVCCalculationResponse
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function PVCResults({ result }: PVCResultsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Material & Cost Breakdown</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="px-3 py-2 font-medium">Material</th>
              <th className="px-3 py-2 font-medium">Quantity</th>
              <th className="px-3 py-2 font-medium">Unit Price</th>
              <th className="px-3 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {result.lineItems.map(item => (
              <tr key={item.key}>
                <td className="px-3 py-2">{item.material}</td>
                <td className="px-3 py-2">
                  {item.quantity.toFixed(2)} {item.unit}
                </td>
                <td className="px-3 py-2">{currency(item.unitPrice)}</td>
                <td className="px-3 py-2 font-medium">{currency(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Strip Count</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{result.breakdown.stripCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Strip Length</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{result.breakdown.stripLength.toFixed(2)} mm</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Billable Strip Meters</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{result.breakdown.billableStripMeters.toFixed(2)} m</p>
        </div>
      </div>
    </section>
  )
}
