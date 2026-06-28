import type { ProposalDoor } from '@/lib/types/quote.types'
import type { PVCCalculationResponse } from '@/lib/types/pvc.types'
import type { PVCFormValues } from './components/PVCForm'

export type PVCDoorQuoteConfig = Pick<
  PVCFormValues,
  | 'width'
  | 'height'
  | 'stripType'
  | 'stripWidth'
  | 'hangerWidth'
  | 'stripsPerHanger'
  | 'thickness'
  | 'overlap'
  | 'headrailType'
  | 'doorType'
>

export interface PVCQuoteLine {
  id: string
  doorQuantity: number
  config: PVCDoorQuoteConfig
  result: PVCCalculationResponse
}

export function clampDoorQuantity(value: number): number {
  return Math.min(99, Math.max(1, Math.trunc(value) || 1))
}

export function pickDoorConfig(values: PVCFormValues): PVCDoorQuoteConfig {
  return {
    width: values.width,
    height: values.height,
    stripType: values.stripType,
    stripWidth: values.stripWidth,
    hangerWidth: values.hangerWidth,
    stripsPerHanger: values.stripsPerHanger,
    thickness: values.thickness,
    overlap: values.overlap,
    headrailType: values.headrailType,
    doorType: values.doorType === 'strips_only' ? 'strips_only' : 'whole_door',
  }
}

export function formatDoorLineSummary(line: PVCQuoteLine): string {
  const qty = clampDoorQuantity(line.doorQuantity)
  const qtyPrefix = qty > 1 ? `${qty}× ` : ''
  return `${qtyPrefix}${line.config.width} × ${line.config.height} mm`
}

export function lineSupplyTotal(line: PVCQuoteLine): number {
  const qty = clampDoorQuantity(line.doorQuantity)
  return line.result.totals.retailBeforeInstallation * qty
}

export function aggregateSupplyTotal(lines: PVCQuoteLine[]): number {
  return lines.reduce((sum, line) => sum + lineSupplyTotal(line), 0)
}

export function aggregateQuoteSupply(lines: PVCQuoteLine[], pending: PVCQuoteLine | null): number {
  return aggregateSupplyTotal(lines) + (pending ? lineSupplyTotal(pending) : 0)
}

export function makePendingQuoteLine(formValues: PVCFormValues, result: PVCCalculationResponse): PVCQuoteLine {
  return {
    id: '__pending__',
    doorQuantity: clampDoorQuantity(formValues.doorQuantity),
    config: pickDoorConfig(formValues),
    result,
  }
}

export function linesForQuotePdf(
  quoteLines: PVCQuoteLine[],
  formValues: PVCFormValues,
  result: PVCCalculationResponse | null,
): PVCQuoteLine[] {
  if (!result) {
    return quoteLines
  }
  return [...quoteLines, makePendingQuoteLine(formValues, result)]
}

export function quoteLineToProposalDoor(line: PVCQuoteLine): ProposalDoor {
  return {
    width_mm: line.config.width,
    height_mm: line.config.height,
    overlap_mm: line.config.overlap,
    strip_width_mm: line.config.stripWidth,
    thickness_mm: line.config.thickness,
    strip_type: line.config.stripType,
    headrail_type: line.config.headrailType,
    number_of_strips: line.result.breakdown.stripCount,
    final_door_price: line.result.totals.retailBeforeInstallation,
    quantity: clampDoorQuantity(line.doorQuantity),
  }
}
