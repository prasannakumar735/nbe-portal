import {
  aggregateQuoteSupply,
  type PVCQuoteLine,
} from '../pvcQuoteLines'

interface PVCQuoteSummaryProps {
  quoteLines: PVCQuoteLine[]
  pendingLine: PVCQuoteLine | null
  installationPrice: number
  freightPrice: number
  canGenerate: boolean
  canSave?: boolean
  isSavingDraft?: boolean
  isGeneratingPdf?: boolean
  /** @deprecated use isGeneratingPdf */
  isSavingQuote?: boolean
  saveLabel?: string
  onSaveQuote?: () => void
  onGenerateQuote: () => void
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function PVCQuoteSummary({
  quoteLines,
  pendingLine,
  installationPrice,
  freightPrice,
  canGenerate,
  canSave = false,
  isSavingDraft = false,
  isGeneratingPdf = false,
  isSavingQuote = false,
  saveLabel = 'Save quote',
  onSaveQuote,
  onGenerateQuote,
}: PVCQuoteSummaryProps) {
  const pdfBusy = isGeneratingPdf || isSavingQuote
  const supplyTotal = aggregateQuoteSupply(quoteLines, pendingLine)
  const sizeCount = quoteLines.length + (pendingLine ? 1 : 0)
  const finalTotal = supplyTotal + installationPrice + freightPrice

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Quote Summary</h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">
            Supply (after margin)
            {sizeCount > 1 ? ` · ${sizeCount} sizes` : ''}
            {pendingLine && quoteLines.length > 0 ? ' (incl. current calc)' : ''}
          </dt>
          <dd className="font-semibold text-slate-900">{currency(supplyTotal)}</dd>
        </div>
        {installationPrice > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Installation (no margin)</dt>
            <dd className="font-semibold text-slate-900">{currency(installationPrice)}</dd>
          </div>
        )}
        {freightPrice > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-slate-600">Freight (no margin)</dt>
            <dd className="font-semibold text-slate-900">{currency(freightPrice)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <dt className="text-slate-800">Final Quote Price</dt>
          <dd className="text-xl font-bold text-indigo-600">{currency(finalTotal)}</dd>
        </div>
      </dl>

      {onSaveQuote && (
        <button
          type="button"
          onClick={onSaveQuote}
          disabled={!canSave || isSavingDraft || pdfBusy}
          className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingDraft ? 'Saving…' : saveLabel}
        </button>
      )}

      <button
        type="button"
        onClick={onGenerateQuote}
        disabled={!canGenerate || pdfBusy || isSavingDraft}
        className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pdfBusy ? 'Generating Quote...' : 'Generate Quote PDF'}
      </button>
      {!canGenerate && (
        <p className="mt-2 text-xs text-slate-500">Calculate a door to see pricing, then generate the PDF.</p>
      )}
      {canGenerate && pendingLine && quoteLines.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Add more sizes with &quot;Add door to quote&quot; before generating, or generate this door only.
        </p>
      )}
    </section>
  )
}
