export type PVCStripType = 'standard' | 'ribbed' | 'colour' | 'polar' | 'ribbed_polar'

export type PVCStripWidth = 100 | 150 | 200 | 300

export type PVCHangerWidth = 100 | 150 | 200 | 300 | 400 | 1200 | 1370

export type PVCOverlapMm = number

export type PVCHeadrailType = 'stainless' | 'galvanized' | 'aluminium' | 'plastic'

export type PVCInstallationType = 'supply_only' | 'supply_install'

export interface PVCCalculatorInput {
  openingWidthMm: number
  openingHeightMm: number
  stripType: PVCStripType
  stripWidth: PVCStripWidth
  hangerWidthMm: PVCHangerWidth
  stripsPerHanger: 1 | 2
  stripThicknessMm: number
  overlapMm: PVCOverlapMm
  headrailType: PVCHeadrailType
  installationType: PVCInstallationType
}

export interface PVCStripLayoutResult {
  doorCoverMm: number
  adjustedDoorWidthMm: number
  effectiveStripWidthMm: number
  stripCount: number
  hangerCount: number
  stripsPerHanger: number
  stripLengthMm: number
  stripMeters: number
  requiredStripMeters: number
  billableStripMeters: number
  rollLengthM: number
  rollCount: number
  actualStripMeters: number
}

export interface PVCHardwareResult {
  headrailLengthMm: number
  bracketCount: number
  rivetsPerStrip: number
  rivetCount: number
}

export interface PVCLabourResult {
  stripMinutes: number
  ribbedMinutes: number
  labourFactor: number
  labourHours: number
  labourCost: number
  ribbedLabourCost: number
}

export interface PVCQuoteLineItem {
  key: string
  material: string
  productId: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  unit: string
}

export interface PVCCalculationBreakdown {
  stripCount: number
  hangerWidth: number
  stripsPerHanger: number
  hangerCount: number
  stripLength: number
  stripMeters: number
  requiredStripMeters: number
  billableStripMeters: number
  projectedStripMeters: number
  rollCount: number
  actualStripMeters: number
  headrailLength: number
  bracketCount: number
  rivetCount: number
  labourHours: number
  ribbedLabourCost: number
  stripCost: number
  headrailCost: number
  hangerCost: number
  bracketCost: number
  rivetCost: number
  labourCost: number
  packagingCost: number
  subtotal: number
  finalPrice: number

  // Backward-compatible fields used by current UI
  stripMaterialCost: number
  fittingCost: number
}

export interface PVCCalculationTotals {
  subtotal: number
  marginPercent: number
  finalPrice: number
}

export interface PVCCalculationResponse {
  breakdown: PVCCalculationBreakdown
  totals: PVCCalculationTotals
  lineItems: PVCQuoteLineItem[]
  quoteId?: string
}
