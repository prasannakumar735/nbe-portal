import type { PVCFormValues } from '@/app/(portal)/pvc-calculator/components/PVCForm'
import type { PVCQuoteLine } from '@/app/(portal)/pvc-calculator/pvcQuoteLines'
import type { PvcJobSupplyScope } from '@/lib/pvc/pvcQuoteWorkflow'

export type PvcJobCardDefaults = {
  supplyScope: PvcJobSupplyScope
  suggestedHeadrailLengthMm: number | null
}

/** Derive approve-form defaults from saved quote lines and current form door type. */
export function derivePvcJobCardDefaults(
  quoteLines: PVCQuoteLine[],
  formValues: Pick<PVCFormValues, 'doorType'>,
  pendingHeadrailLengthMm?: number | null,
): PvcJobCardDefaults {
  const formScope: PvcJobSupplyScope =
    formValues.doorType === 'strips_only' ? 'strips_only' : 'whole_door'

  if (quoteLines.length === 0) {
    const pending =
      formScope === 'whole_door' &&
      pendingHeadrailLengthMm != null &&
      Number.isFinite(pendingHeadrailLengthMm) &&
      pendingHeadrailLengthMm > 0
        ? Math.round(pendingHeadrailLengthMm)
        : null
    return {
      supplyScope: formScope,
      suggestedHeadrailLengthMm: pending,
    }
  }

  const allStripsOnly = quoteLines.every(line => line.config.doorType === 'strips_only')
  const supplyScope: PvcJobSupplyScope = allStripsOnly ? 'strips_only' : 'whole_door'

  if (supplyScope === 'strips_only') {
    return { supplyScope, suggestedHeadrailLengthMm: null }
  }

  const lengths = quoteLines
    .filter(line => line.config.doorType !== 'strips_only')
    .map(line => line.result.breakdown.headrailLength)

  const pool = lengths.length > 0 ? lengths : quoteLines.map(line => line.result.breakdown.headrailLength)
  const maxMm = Math.max(...pool.filter(n => Number.isFinite(n)))
  const suggestedHeadrailLengthMm = Number.isFinite(maxMm) && maxMm > 0 ? Math.round(maxMm) : null

  return { supplyScope, suggestedHeadrailLengthMm }
}
