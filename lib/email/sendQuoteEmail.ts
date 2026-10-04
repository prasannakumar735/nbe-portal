import { sendMailViaGraph } from '@/lib/graph/sendMail'
import type { QuoteData } from '@/lib/types/quote.types'

function currency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value)
}

export async function sendQuoteEmail(
  quoteData: QuoteData,
  pdfBuffer: Uint8Array,
  fileName: string,
): Promise<void> {
  const to = process.env.PVC_QUOTE_NOTIFY_EMAIL || 'accounts@nbeaustralia.com.au'

  await sendMailViaGraph({
    to,
    subject: 'New PVC Strip Door Quote Generated',
    bodyText: [
      'A new PVC strip door quote has been generated from the NBE Portal.',
      '',
      `Width: ${quoteData.input.width_mm} mm`,
      `Height: ${quoteData.input.height_mm} mm`,
      `Strip Type: ${quoteData.input.strip_type}`,
      `Number of Strips: ${quoteData.calculated.strip_count}`,
      `Final Quote Price: ${currency(quoteData.calculated.final_quote_price)}`,
    ].join('\n'),
    attachments: [
      {
        name: fileName,
        contentType: 'application/pdf',
        contentBytes: Buffer.from(pdfBuffer).toString('base64'),
      },
    ],
  })
}
