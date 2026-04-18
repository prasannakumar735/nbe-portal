'use client'

import { pdf } from '@react-pdf/renderer'
import { QuotePDF } from './QuotePDF'
import type { ServiceQuoteFormValues } from './types'
import { computeServiceQuoteTotals } from '@/lib/quotes/serviceQuoteSnapshot'

export async function downloadServiceQuotePdf(formValues: ServiceQuoteFormValues, fileName?: string) {
  const { subtotal, gst, grandTotal } = computeServiceQuoteTotals(formValues)
  const blob = await pdf(
    <QuotePDF data={{ values: formValues, subtotal, gst, grandTotal }} />,
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName ?? `service-quote-${formValues.quoteNumber || 'export'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
