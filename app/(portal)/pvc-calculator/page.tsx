'use client'

import { useState } from 'react'
import { PVCForm, type PVCFormValues } from './components/PVCForm'
import { PVCResults } from './components/PVCResults'
import { PVCQuoteSummary } from './components/PVCQuoteSummary'
import { pvcCalculatorService } from './services/pvcCalculatorService'
import type { PVCCalculationResponse } from '@/lib/types/pvc.types'
import type { QuoteGenerateResponse } from '@/lib/types/quote.types'
import NBELogo from '@/components/common/NBELogo'

async function callGenerateQuoteApi(payload: {
  quoteData: {
    input: {
      width_mm: number
      height_mm: number
      strip_type: string
      strip_width_mm: number
      thickness_mm: number
      overlap_mm: number
      headrail_type: string
      install_type: string
    }
    calculated: {
      strip_count: number
      strip_length_mm: number
      strip_meters: number
      pvc_strip_cost: number
      headrail_cost: number
      bracket_cost: number
      fittings_cost: number
      packaging_cost: number
      labour_cost: number
      subtotal: number
      markup_percent: number
      final_quote_price: number
    }
    result: PVCCalculationResponse
  }
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

export default function PVCCalculatorPage() {
  const [formValues, setFormValues] = useState<PVCFormValues>({
    width: 3000,
    height: 2500,
    stripType: 'standard',
    stripWidth: 200,
    hangerWidth: 200,
    stripsPerHanger: 1,
    thickness: 2,
    overlap: 50,
    headrailType: 'galvanized',
    installType: 'supply_install',
  })
  const [result, setCalculationResult] = useState<PVCCalculationResponse | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isSavingQuote, setIsSavingQuote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const updateField = <K extends keyof PVCFormValues>(field: K, value: PVCFormValues[K]) => {
    setFormValues(current => {
      if (field === 'stripWidth') {
        const stripWidth = value as PVCFormValues['stripWidth']
        const nextHangerWidth = stripWidth
        const isHundred = stripWidth === 100
        const nextOverlap = isHundred ? 15 : current.overlap
        const nextStripsPerHanger = isHundred && nextHangerWidth === 150 ? 2 : (isHundred ? current.stripsPerHanger : 1)
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
        const nextStripsPerHanger = current.stripWidth === 100 && nextHangerWidth === 150
          ? 2
          : (current.stripWidth === 100 ? current.stripsPerHanger : 1)
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
      const result = await pvcCalculatorService.calculate(formValues)
      setCalculationResult(result)
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'Calculation failed.')
    } finally {
      setIsCalculating(false)
    }
  }

  const handleGenerateQuote = async () => {
    if (!result) {
      setError('Please run the calculation first.')
      return
    }

    try {
      setError(null)
      setSuccess(null)
      setIsSavingQuote(true)
      const generated = await callGenerateQuoteApi({
        quoteData: {
          input: {
            width_mm: formValues.width,
            height_mm: formValues.height,
            strip_type: formValues.stripType,
            strip_width_mm: formValues.stripWidth,
            thickness_mm: formValues.thickness,
            overlap_mm: formValues.overlap,
            headrail_type: formValues.headrailType,
            install_type: formValues.installType,
          },
          calculated: {
            strip_count: result.breakdown.stripCount,
            strip_length_mm: result.breakdown.stripLength,
            strip_meters: result.breakdown.stripMeters,
            pvc_strip_cost: result.breakdown.stripCost,
            headrail_cost: result.breakdown.headrailCost,
            bracket_cost: result.breakdown.bracketCost,
            fittings_cost: result.breakdown.fittingCost,
            packaging_cost: result.breakdown.packagingCost,
            labour_cost: result.breakdown.labourCost,
            subtotal: result.totals.subtotal,
            markup_percent: result.totals.marginPercent,
            final_quote_price: result.totals.finalPrice,
          },
          result,
        },
      })

      if (generated.pdfUrl) {
        triggerBrowserDownload(generated.pdfUrl, generated.fileName)
      } else if (generated.pdfBase64) {
        triggerBrowserDownloadFromBase64(generated.pdfBase64, generated.fileName)
      } else {
        throw new Error('Quote PDF was generated but no download URL or file content was returned.')
      }

      if (generated.audit.email.status === 'sent') {
        setSuccess('Quote generated and sent to service@nbeaustralia.com.au')
      } else {
        setSuccess('Quote PDF generated and downloaded successfully (email not configured yet).')
      }
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : 'Quote generation failed.')
    } finally {
      setIsSavingQuote(false)
    }
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <NBELogo />
        <div className="text-right">
          <h1 className="text-xl font-bold text-slate-900">PVC Strip Curtain Calculator</h1>
          <p className="mt-0.5 text-xs text-slate-500">Estimate strip curtain quantities and generate a quote from Supabase pricing.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <PVCForm values={formValues} isLoading={isCalculating} onChange={updateField} onSubmit={handleCalculate} />

      {result && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PVCResults result={result} />
          </div>
          <div>
            <PVCQuoteSummary result={result} isSavingQuote={isSavingQuote} onGenerateQuote={handleGenerateQuote} />
          </div>
        </div>
      )}
    </div>
  )
}
