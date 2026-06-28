import {
  aggregateQuoteSupply,
  linesForQuotePdf,
  quoteLineToProposalDoor,
} from '@/app/(portal)/pvc-calculator/pvcQuoteLines'
import type { PVCCalculatorSnapshotV1 } from '@/lib/pvc/pvcCalculatorSnapshot'
import { round2 } from '@/lib/pvc/pvcCalculatorSnapshot'
import type { QuoteData } from '@/lib/types/quote.types'
import type { PVCCalculationResponse } from '@/lib/types/pvc.types'

/** Rebuild proposal PDF payload from latest saved calculator snapshot. */
export function snapshotToQuoteData(snapshot: PVCCalculatorSnapshotV1): QuoteData {
  const { formValues, quoteLines, quoteExtras } = snapshot
  const effectiveLines = linesForQuotePdf(quoteLines, formValues, null)
  if (effectiveLines.length === 0) {
    throw new Error('Quote has no door lines to generate a PDF.')
  }

  const first = effectiveLines[0]
  const installationPrice = quoteExtras.installationPrice
  const freightPrice = quoteExtras.freightPrice
  const supplyTotal = aggregateQuoteSupply(quoteLines, null)
  const quoteFinalPrice = round2(supplyTotal + installationPrice + freightPrice)

  const extrasResult: PVCCalculationResponse = first.result

  const doors = effectiveLines.map(quoteLineToProposalDoor)

  return {
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
  }
}
