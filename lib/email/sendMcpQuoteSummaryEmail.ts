import nodemailer from 'nodemailer'
import { generateProposalPdf } from '@/lib/pdf/generateProposalPdf'
import type { QuoteData } from '@/lib/types/quote.types'
import type { PVCCalculationResponse } from '@/lib/types/pvc.types'

export interface McpQuoteSummaryEmailInput {
  recipientEmail: string
  // Customer details (optional — shown on PDF)
  customerName?: string
  customerAttn?: string
  customerAddress?: string
  refNo?: string
  // Quote dimensions & spec
  openingWidth: number
  openingHeight: number
  stripType: string
  stripWidth: number
  stripThicknessMm: number
  overlapMm: number
  headrailType: string
  doorType: string
  installationType: string
  // Quote result (from calculate_pvc_quote breakdown)
  stripCount: number
  hangerCount: number
  stripLengthMm: number
  billableStripMeters: number
  retailBeforeInstallation: number
  installationCost?: number
  finalPrice: number
  freightEstimate?: number
  // Full raw result for PDF line items
  calculationResult: PVCCalculationResponse
}

export async function sendMcpQuoteSummaryEmail(input: McpQuoteSummaryEmailInput): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass || !from) {
    throw new Error('SMTP not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.')
  }

  if (!input.recipientEmail.toLowerCase().endsWith('@nbeaustralia.com.au')) {
    throw new Error('Recipient must be an @nbeaustralia.com.au address.')
  }

  // Build QuoteData matching the portal's PDF generator format
  const quoteData: QuoteData = {
    input: {
      width_mm: input.openingWidth,
      height_mm: input.openingHeight,
      strip_type: input.stripType,
      strip_width_mm: input.stripWidth,
      thickness_mm: input.stripThicknessMm,
      overlap_mm: input.overlapMm,
      headrail_type: input.headrailType,
      install_type: input.installationType,
      door_quantity: 1,
    },
    calculated: {
      strip_count: input.stripCount,
      strip_length_mm: input.stripLengthMm,
      strip_meters: input.billableStripMeters,
      pvc_strip_cost: input.calculationResult.breakdown.stripCost,
      headrail_cost: input.calculationResult.breakdown.headrailCost,
      bracket_cost: input.calculationResult.breakdown.bracketCost,
      fittings_cost: input.calculationResult.breakdown.rivetCost,
      packaging_cost: input.calculationResult.breakdown.packagingCost,
      labour_cost: input.calculationResult.breakdown.labourCost,
      subtotal: input.calculationResult.totals.subtotal,
      markup_percent: input.calculationResult.totals.marginPercent,
      final_quote_price: input.retailBeforeInstallation,
      retail_before_installation: input.retailBeforeInstallation,
      installation_price: input.installationCost ?? 0,
      freight_price: input.freightEstimate ?? 0,
    },
    result: input.calculationResult,
    customerDetails: {
      customer: input.customerName ?? '',
      attn: input.customerAttn ?? '',
      address: input.customerAddress ?? '',
      date: new Date().toLocaleDateString('en-AU'),
      refNo: input.refNo ?? '',
    },
    doors: [
      {
        width_mm: input.openingWidth,
        height_mm: input.openingHeight,
        overlap_mm: input.overlapMm,
        strip_width_mm: input.stripWidth,
        thickness_mm: input.stripThicknessMm,
        strip_type: input.stripType,
        headrail_type: input.headrailType,
        number_of_strips: input.stripCount,
        final_door_price: input.retailBeforeInstallation,
        quantity: 1,
      },
    ],
    freightCost: input.freightEstimate && input.freightEstimate > 0 ? input.freightEstimate : undefined,
    installationCost: input.installationCost && input.installationCost > 0 ? input.installationCost : undefined,
  }

  const pdfBytes = await generateProposalPdf(quoteData)
  const fileName = `PVC_Quote_${input.openingWidth}Wx${input.openingHeight}H_${Date.now()}.pdf`

  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })

  await transporter.sendMail({
    from,
    to: input.recipientEmail,
    subject: `[Review] PVC Quote — ${input.openingWidth}W × ${input.openingHeight}H, ${input.stripWidth}mm ${input.stripType}`,
    text: [
      'Please find the PVC strip curtain quote attached for internal review.',
      'Review and forward to the customer once approved.',
      '',
      `Opening: ${input.openingWidth}mm W × ${input.openingHeight}mm H`,
      `Strip: ${input.stripWidth}mm × ${input.stripThicknessMm}mm ${input.stripType}`,
      `Supply price (ex GST): ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(input.retailBeforeInstallation)}`,
      '',
      '* Generated via ChatGPT MCP connector',
    ].join('\n'),
    attachments: [
      {
        filename: fileName,
        content: Buffer.from(pdfBytes),
        contentType: 'application/pdf',
      },
    ],
  })
}
