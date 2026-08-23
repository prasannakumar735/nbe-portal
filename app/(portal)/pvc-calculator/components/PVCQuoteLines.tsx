import {
  aggregateSupplyTotal,
  formatDoorLineSummary,
  lineSupplyTotal,
  type PVCQuoteLine,
} from '../pvcQuoteLines'

interface PVCQuoteLinesProps {
  lines: PVCQuoteLine[]
  onRemove: (id: string) => void
  onEdit?: (id: string) => void
  editingLineId?: string | null
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function PVCQuoteLines({ lines, onRemove, onEdit, editingLineId }: PVCQuoteLinesProps) {
  if (lines.length === 0) {
    return null
  }

  const supplyTotal = aggregateSupplyTotal(lines)

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Doors on this quote</h2>
        <p className="text-sm text-slate-600">
          {lines.length} line{lines.length === 1 ? '' : 's'} · Supply {currency(supplyTotal)}
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {lines.map((line, index) => (
          <li
            key={line.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
              editingLineId === line.id
                ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="min-w-0">
              <span className="font-medium text-slate-900">
                {index + 1}. {formatDoorLineSummary(line)}
              </span>
              {editingLineId === line.id && (
                <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Editing…
                </span>
              )}
              <span className="mt-0.5 block text-xs text-slate-500">
                {line.config.stripWidth} mm strip · {line.config.stripType.replace(/_/g, ' ')} ·{' '}
                {line.result.breakdown.stripCount} strips
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-800">{currency(lineSupplyTotal(line))}</span>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(line.id)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(line.id)}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-slate-600">
        Change opening size below, calculate, then use &quot;Add door to quote&quot; for each different size.
      </p>
    </section>
  )
}
