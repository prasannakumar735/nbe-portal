'use client'

import { pdf } from '@react-pdf/renderer'
import { RapidDoorQuotePDF } from './RapidDoorQuotePDF'
import type { RapidDoorQuoteFormValues } from './types'
import { computeServiceQuoteTotals } from '@/lib/quotes/serviceQuoteSnapshot'

export async function downloadRapidDoorQuotePdf(formValues: RapidDoorQuoteFormValues, fileName?: string) {
  const { subtotal, gst, grandTotal } = computeServiceQuoteTotals(formValues)
  const blob = await pdf(
    <RapidDoorQuotePDF data={{ values: formValues, subtotal, gst, grandTotal }} />,
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName ?? `industrial-rapid-door-${formValues.quoteNumber || 'export'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
