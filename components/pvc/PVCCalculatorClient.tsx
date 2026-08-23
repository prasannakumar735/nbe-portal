'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PVCForm, type PVCFormValues } from '@/app/(portal)/pvc-calculator/components/PVCForm'
import { PVCResults } from '@/app/(portal)/pvc-calculator/components/PVCResults'
import { PVCQuoteSummary } from '@/app/(portal)/pvc-calculator/components/PVCQuoteSummary'
import { PVCQuoteLines } from '@/app/(portal)/pvc-calculator/components/PVCQuoteLines'
import { pvcCalculatorService } from '@/app/(portal)/pvc-calculator/services/pvcCalculatorService'
import {
  aggregateQuoteSupply,
  clampDoorQuantity,
  linesForQuotePdf,
  makePendingQuoteLine,
  pickDoorConfig,
  quoteLineToProposalDoor,
  type PVCQuoteLine,
} from '@/app/(portal)/pvc-calculator/pvcQuoteLines'
import type { PVCCalculationResponse } from '@/lib/types/pvc.types'
import type { QuoteData, QuoteGenerateResponse } from '@/lib/types/quote.types'
import NBELogo from '@/components/common/NBELogo'
import { buildSnapshotV1, round2, type PVCCalculatorSnapshotV1 } from '@/lib/pvc/pvcCalculatorSnapshot'
import { createInitialPVCFormValues } from '@/lib/pvc/pvcFormDefaults'
import { derivePvcJobCardDefaults } from '@/lib/pvc/pvcJobCardDefaults'
import { PVCQuoteWorkflowStepper } from '@/components/pvc/PVCQuoteWorkflowStepper'
import {
  PVCQuoteWorkflowPanel,
  type PvcQuoteWorkflowState,
} from '@/components/pvc/PVCQuoteWorkflowPanel'

async function callGenerateQuoteApi(payload: {
  quoteData: QuoteData
  draftId?: string | null
}): Promise<QuoteGenerateResponse> {
  const response = await fetch('/api/quotes/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate quote PDF.')
  }
  return data as QuoteGenerateResponse
}

function triggerBrowserDownload(url: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.target = '_blank'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

function triggerBrowserDownloadFromBase64(base64: string, filename: string) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  triggerBrowserDownload(url, filename)
  URL.revokeObjectURL(url)
}

export type PVCCalculatorClientProps = {
  mode?: 'create' | 'edit'
  draftId?: string | null
  initialSnapshot?: PVCCalculatorSnapshotV1 | null
  /** Called after a quote is saved or a PDF is generated so lists can refresh. */
  onQuotesChanged?: () => void
  workflow?: PvcQuoteWorkflowState | null
  isManager?: boolean
  onWorkflowUpdated?: () => void
}

export function PVCCalculatorClient({
  mode = 'create',
  draftId: initialDraftId = null,
  initialSnapshot = null,
  onQuotesChanged,
  workflow = null,
  isManager = false,
  onWorkflowUpdated,
}: PVCCalculatorClientProps) {
  const router = useRouter()
  const [draftId, setDraftId] = useState<string | null>(initialDraftId)
  const [formValues, setFormValues] = useState<PVCFormValues>(
    () => initialSnapshot?.formValues ?? createInitialPVCFormValues(),
  )
  const [quoteLines, setQuoteLines] = useState<PVCQuoteLine[]>(() => initialSnapshot?.quoteLines ?? [])
  const [quoteExtras, setQuoteExtras] = useState(
    () =>
      initialSnapshot?.quoteExtras ?? {
        installationPrice: 0,
        freightPrice: 0,
      },
  )
  const [result, setCalculationResult] = useState<PVCCalculationResponse | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Send-email modal state
  const [showSendEmail, setShowSendEmail] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [attachPdf, setAttachPdf] = useState(true)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  function buildEmailBody() {
    const customer = formValues.customer.trim() || '[customer]'
    const attn = formValues.attn.trim()
    const customerLine = attn ? `${attn} (${customer})` : customer
    const doorLines = quoteLines.flatMap((line, i) => [
      `  * Door ${i + 1}${line.doorQuantity > 1 ? ` (×${line.doorQuantity})` : ''}`,
      `     * ${line.config.stripWidth} mm × ${line.config.thickness} mm PVC Strips`,
      `     * Internal Dimensions: ${line.config.width}W × ${line.config.height}H mm`,
    ])
    const measurementsSection = quoteLines.length > 0
      ? ['Please also find the opening measurements below:', '', ...doorLines, '']
      : []
    return [
      'Hi,',
      '',
      `Please find attached the PVC Strip Curtain quotation for ${customerLine}.`,
      '',
      ...measurementsSection,
      'Please let me know if you require any further information or any changes to the quotation.',
      '',
      'Kind regards',
    ].join('\n')
  }

  function openSendEmailModal() {
    setEmailBody(buildEmailBody())
    setEmailRecipients('')
    setAttachPdf(true)
    setEmailError(null)
    setShowSendEmail(true)
  }

  const handleSendEmail = async () => {
    if (!draftId) return
    const trimmedRecipients = emailRecipients.trim()
    if (!trimmedRecipients) { setEmailError('Enter at least one email address.'); return }
    setIsSendingEmail(true)
    setEmailError(null)
    try {
      const res = await fetch(`/api/pvc/quotes/${draftId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_emails: trimmedRecipients,
          email_body: emailBody,
          attach_pdf: attachPdf,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send email')
      setShowSendEmail(false)
      const sentTo = Array.isArray(data.sent_to) ? data.sent_to.join(', ') : String(data.sent_to)
      setSuccess(`Email sent to ${sentTo}`)
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Failed to send email')
    } finally {
      setIsSendingEmail(false)
    }
  }

  const jobCardDefaults = useMemo(
    () => derivePvcJobCardDefaults(quoteLines, formValues, result?.breakdown.headrailLength ?? null),
    [quoteLines, formValues, result],
  )

  const updateField = <K extends keyof PVCFormValues>(field: K, value: PVCFormValues[K]) => {
    setFormValues(current => {
      if (field === 'stripWidth') {
        const stripWidth = value as PVCFormValues['stripWidth']
        const nextHangerWidth = stripWidth
        const isHundred = stripWidth === 100
        const nextOverlap = isHundred ? 15 : current.overlap
        const nextStripsPerHanger =
          isHundred && nextHangerWidth === 150 ? 2 : isHundred ? current.stripsPerHanger : 1
        return {
          ...current,
          stripWidth,
          hangerWidth: nextHangerWidth,
          overlap: nextOverlap,
          stripsPerHanger: nextStripsPerHanger,
        }
      }
      if (field === 'hangerWidth') {
        const nextHangerWidth = value as PVCFormValues['hangerWidth']
        const nextStripsPerHanger =
          current.stripWidth === 100 && nextHangerWidth === 150
            ? 2
            : current.stripWidth === 100
              ? current.stripsPerHanger
              : 1
        return {
          ...current,
          hangerWidth: nextHangerWidth,
          stripsPerHanger: nextStripsPerHanger,
        }
      }
      if (field === 'stripsPerHanger') {
        return {
          ...current,
          stripsPerHanger: current.stripWidth === 100 ? (value as 1 | 2) : 1,
        }
      }
      return {
        ...current,
        [field]: value,
      }
    })
  }

  const handleCalculate = async () => {
    try {
      setError(null)
      setSuccess(null)
      setIsCalculating(true)
      const calcResult = await pvcCalculatorService.calculate(formValues)
      setCalculationResult(calcResult)
      setQuoteExtras({
        installationPrice: calcResult.totals.installationPrice,
        freightPrice: calcResult.totals.freightPrice,
      })
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'Calculation failed.')
    } finally {
      setIsCalculating(false)
    }
  }

  const [editingLineId, setEditingLineId] = useState<string | null>(null)

  const handleAddToQuote = useCallback(() => {
    if (!result) {
      setError('Calculate this door first, then add it to the quote.')
      return
    }
    if (editingLineId) {
      // Replace the existing line in-place
      const updated: PVCQuoteLine = {
        id: editingLineId,
        doorQuantity: clampDoorQuantity(formValues.doorQuantity),
        config: pickDoorConfig(formValues),
        result,
      }
      setQuoteLines(current => current.map(l => l.id === editingLineId ? updated : l))
      setEditingLineId(null)
      setSuccess('Door updated.')
    } else {
      const line: PVCQuoteLine = {
        id: crypto.randomUUID(),
        doorQuantity: clampDoorQuantity(formValues.doorQuantity),
        config: pickDoorConfig(formValues),
        result,
      }
      setQuoteLines(current => [...current, line])
      setSuccess('Door added to quote. Enter another size and calculate, or save or generate the PDF.')
    }
    setQuoteExtras({
      installationPrice: result.totals.installationPrice,
      freightPrice: result.totals.freightPrice,
    })
    setCalculationResult(null)
    setFormValues(current => ({ ...current, doorQuantity: 1 }))
    setError(null)
  }, [formValues, result, editingLineId])

  const handleRemoveQuoteLine = useCallback((id: string) => {
    setQuoteLines(current => current.filter(line => line.id !== id))
    setEditingLineId(current => current === id ? null : current)
  }, [])

  const handleEditQuoteLine = useCallback((id: string) => {
    const line = quoteLines.find(l => l.id === id)
    if (!line) return
    setFormValues(v => ({ ...v, ...line.config, doorQuantity: line.doorQuantity }))
    setCalculationResult(null)
    setEditingLineId(id)
    setTimeout(() => {
      document.getElementById('pvc-calculator-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [quoteLines])

  const buildCurrentSnapshot = useCallback(() => {
    return buildSnapshotV1({
      formValues,
      quoteLines,
      quoteExtras: {
        installationPrice: result?.totals.installationPrice ?? quoteExtras.installationPrice,
        freightPrice: result?.totals.freightPrice ?? quoteExtras.freightPrice,
      },
    })
  }, [formValues, quoteLines, quoteExtras, result])

  const handleSaveQuote = async () => {
    try {
      setError(null)
      setSuccess(null)
      setIsSavingDraft(true)
      const form_snapshot = buildCurrentSnapshot()
      const isEdit = Boolean(draftId)
      const url = isEdit ? `/api/pvc/quotes/${draftId}` : '/api/pvc/quotes'
      const method = isEdit ? 'PATCH' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_snapshot }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save quote.')
      }
      const newId = isEdit ? draftId : (data.quote_id as string)
      if (!isEdit && data.quote_id) {
        setDraftId(String(data.quote_id))
        router.replace(`/pvc-calculator/${data.quote_id}/edit`)
      }
      setEditingLineId(null)
      setSuccess(isEdit ? 'Quote updated.' : 'Quote saved.')
      onQuotesChanged?.()
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'Failed to save quote.')
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleGenerateQuote = async () => {
    const effectiveLines = linesForQuotePdf(quoteLines, formValues, result)
    if (effectiveLines.length === 0) {
      setError('Calculate a door first, then generate the quote PDF.')
      return
    }
    try {
      setError(null)
      setSuccess(null)
      setIsGeneratingPdf(true)

      if (draftId) {
        const form_snapshot = buildCurrentSnapshot()
        const patchRes = await fetch(`/api/pvc/quotes/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form_snapshot }),
        })
        const patchData = await patchRes.json()
        if (!patchRes.ok) {
          throw new Error(patchData.error || 'Failed to update saved quote before PDF.')
        }
      }

      const extrasResult = result ?? (await pvcCalculatorService.calculate(formValues))
      const installationPrice = extrasResult.totals.installationPrice
      const freightPrice = extrasResult.totals.freightPrice
      const supplyTotal = aggregateQuoteSupply(
        quoteLines,
        result ? makePendingQuoteLine(formValues, result) : null,
      )
      const quoteFinalPrice = round2(supplyTotal + installationPrice + freightPrice)

      const doors = effectiveLines.map(quoteLineToProposalDoor)
      const first = effectiveLines[0]

      const generated = await callGenerateQuoteApi({
        draftId: draftId ?? undefined,
        quoteData: {
          input: {
            width_mm: first.config.width,
            height_mm: first.config.height,
            strip_type: first.config.stripType,
            strip_width_mm: first.config.stripWidth,
            thickness_mm: first.config.thickness,
            overlap_mm: first.config.overlap,
            headrail_type: first.config.headrailType,
            install_type: formValues.installType,
            door_quantity: first.doorQuantity,
          },
          calculated: {
            strip_count: first.result.breakdown.stripCount,
            strip_length_mm: first.result.breakdown.stripLength,
            strip_meters: first.result.breakdown.stripMeters,
            pvc_strip_cost: first.result.breakdown.stripCost,
            headrail_cost: first.result.breakdown.headrailCost,
            bracket_cost: first.result.breakdown.bracketCost,
            fittings_cost: first.result.breakdown.fittingCost,
            packaging_cost: first.result.breakdown.packagingCost,
            labour_cost: first.result.breakdown.labourCost,
            subtotal: first.result.totals.subtotal,
            markup_percent: first.result.totals.marginPercent,
            final_quote_price: quoteFinalPrice,
            installation_price: installationPrice,
            freight_price: freightPrice,
            retail_before_installation: first.result.totals.retailBeforeInstallation,
          },
          result: extrasResult,
          customerDetails: {
            customer: formValues.customer.trim() || undefined,
            attn: formValues.attn.trim() || undefined,
            address: formValues.address.trim() || undefined,
            refNo: formValues.refNo.trim() || undefined,
          },
          doors,
          freightCost: freightPrice > 0 ? freightPrice : undefined,
          installationCost: installationPrice > 0 ? installationPrice : undefined,
        },
      })

      if (generated.pdfUrl) {
        triggerBrowserDownload(generated.pdfUrl, generated.fileName)
      } else if (generated.pdfBase64) {
        triggerBrowserDownloadFromBase64(generated.pdfBase64, generated.fileName)
      } else {
        throw new Error('Quote PDF was generated but no download URL or file content was returned.')
      }
      if (generated.quoteId && !draftId) {
        setDraftId(generated.quoteId)
      }
      if (generated.audit.email.status === 'sent') {
        setSuccess('Quote generated and sent to service@nbeaustralia.com.au')
      } else {
        setSuccess('Quote PDF generated and downloaded successfully (email not configured yet).')
      }
      onQuotesChanged?.()
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'Quote generation failed.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const showQuotePanel = quoteLines.length > 0 || result !== null
  const pendingLine = result ? makePendingQuoteLine(formValues, result) : null
  const canSave = quoteLines.length > 0 || result !== null

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/pvc-calculator"
          className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          Back to saved quotes
        </Link>
        <div className="flex items-center gap-3">
          {mode === 'edit' && draftId ? (
            <Link
              href="/pvc-calculator/new"
              className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              New quote
            </Link>
          ) : null}
        </div>
      </div>

      <div id="pvc-calculator-form" className="flex flex-wrap items-center justify-between gap-4">
        <NBELogo />
        <div className="text-right">
          <h1 className="text-xl font-bold text-slate-900">PVC Strip Curtain Calculator</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Estimate strip curtain quantities, save quotes, and generate PDFs from live pricing.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <PVCQuoteLines lines={quoteLines} onRemove={handleRemoveQuoteLine} onEdit={handleEditQuoteLine} editingLineId={editingLineId} />

      <PVCForm values={formValues} isLoading={isCalculating} onChange={updateField} onSubmit={handleCalculate} />

      {showQuotePanel && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {result && <PVCResults result={result} />}
            {result && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddToQuote}
                  className="rounded-lg border border-indigo-600 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                >
                  {editingLineId ? 'Update door' : 'Add door to quote'}
                </button>
                {editingLineId ? (
                  <button
                    type="button"
                    onClick={() => { setEditingLineId(null); setCalculationResult(null); setFormValues(v => ({ ...v, doorQuantity: 1 })) }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel edit
                  </button>
                ) : (
                  <p className="self-center text-xs text-slate-500">
                    Use again for each different opening size on the same quote.
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <PVCQuoteSummary
              quoteLines={quoteLines}
              pendingLine={pendingLine}
              installationPrice={result?.totals.installationPrice ?? quoteExtras.installationPrice}
              freightPrice={result?.totals.freightPrice ?? quoteExtras.freightPrice}
              canGenerate={quoteLines.length > 0 || result !== null}
              canSave={canSave}
              isSavingDraft={isSavingDraft}
              isGeneratingPdf={isGeneratingPdf}
              saveLabel={draftId ? 'Update saved quote' : 'Save quote'}
              onSaveQuote={handleSaveQuote}
              onGenerateQuote={handleGenerateQuote}
              onSendEmail={mode === 'edit' ? openSendEmailModal : undefined}
              canSendEmail={!!draftId && quoteLines.length > 0}
            />
          </div>
        </div>
      )}

      <div className="mt-8 space-y-4 border-t border-slate-200 pt-6 print:hidden">
        {draftId ? (
          workflow ? (
            <PVCQuoteWorkflowPanel
              quoteId={draftId}
              workflow={workflow}
              isManager={isManager}
              onUpdated={onWorkflowUpdated}
              showStepper={false}
              jobCardDefaults={jobCardDefaults}
            />
          ) : (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Workflow actions unavailable (run the PVC quote workflow database migration).
            </section>
          )
        ) : null}
        <PVCQuoteWorkflowStepper
          workflowStatus={workflow?.workflow_status ?? 'draft_review'}
          invoiceStatus={workflow?.invoice_status ?? null}
        />
        {!draftId ? (
          <p className="text-center text-xs text-slate-500">
            Save this quote to track progress through approval, fulfilment, and invoicing.
          </p>
        ) : null}
      </div>

      {/* Send Email Modal */}
      {showSendEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Send quote by email</h2>
              <button
                type="button"
                onClick={() => setShowSendEmail(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  To <span className="text-slate-400 font-normal">(separate multiple addresses with commas)</span>
                </label>
                <input
                  type="text"
                  value={emailRecipients}
                  onChange={e => setEmailRecipients(e.target.value)}
                  placeholder="manager@example.com, another@example.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email body</label>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono leading-relaxed focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={attachPdf}
                  onChange={e => setAttachPdf(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Attach quote PDF
              </label>

              {emailError && (
                <p className="text-sm text-red-600">{emailError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowSendEmail(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingEmail || !emailRecipients.trim()}
                onClick={() => void handleSendEmail()}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {isSendingEmail ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
