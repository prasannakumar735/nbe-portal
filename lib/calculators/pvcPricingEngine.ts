import type {
  PVCCalculationResponse,
  PVCCalculatorInput,
  PVCHardwareResult,
  PVCLabourResult,
  PVCQuoteLineItem,
  PVCStripLayoutResult,
} from '@/lib/types/pvc.types'

export const PVC_CALCULATOR_VERSION = '1.0.0'

const DOOR_COVER_MM = 50
const HEADRAIL_ALLOWANCE_MM = 50
const ROLL_LENGTH_M = 50

const RIVETS_PER_STRIP: Record<number, number> = {
  100: 2,
  150: 3,
  200: 4,
  300: 5,
}

export type PVCPricingSettings = {
  labour_minutes_per_strip: number
  minutes_per_headrail: number
  install_setup_minutes: number
  labour_rate_per_hour: number
  markup_multiplier: number
}

export type PVCPricingPriceSelection = {
  stripProductId: string | null
  headrailProductId: string | null
  bracketProductId: string | null
  fittingProductId: string | null
  labourProductId: string | null
  packagingProductId: string | null
  stripUnitPrice: number
  headrailUnitPrice: number
  bracketUnitPrice: number
  rivetUnitPrice: number
  rivetsPerStrip: number | null
  packagingUnitPrice: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function createLineItem(
  key: string,
  material: string,
  productId: string | null,
  quantity: number,
  unitPrice: number,
  unit: string,
): PVCQuoteLineItem {
  return {
    key,
    material,
    productId,
    quantity: round2(quantity),
    unitPrice: round2(unitPrice),
    lineTotal: round2(quantity * unitPrice),
    unit,
  }
}

export function calculateStripLayout(input: PVCCalculatorInput): PVCStripLayoutResult {
  const stripsPerHanger = input.stripWidth === 100
    ? (input.stripsPerHanger || (input.hangerWidthMm === 150 ? 2 : 1))
    : 1

  const adjustedDoorWidthMm = input.openingWidthMm + (DOOR_COVER_MM * 2) + input.hangerWidthMm
  const effectiveStripWidthMm = input.stripWidth - input.overlapMm

  if (effectiveStripWidthMm <= 0) {
    throw new Error('Invalid overlap_mm: effective strip width must be greater than zero.')
  }

  const rawStripCount = Math.ceil(adjustedDoorWidthMm / effectiveStripWidthMm)
  const effectiveStripCount = Math.ceil(rawStripCount / stripsPerHanger)
  const stripCount = Math.ceil(effectiveStripCount / 3) * 3
  const hangerCount = Math.ceil(stripCount / stripsPerHanger)

  const stripLengthMm = input.openingHeightMm + DOOR_COVER_MM
  const stripLengthM = stripLengthMm / 1000
  const requiredStripMeters = (stripCount * stripLengthMm) / 1000
  const billableStripMeters = round2(stripCount * stripLengthM)

  const stripMeters = requiredStripMeters
  const rollCount = Math.ceil(requiredStripMeters / ROLL_LENGTH_M)
  const actualStripMeters = requiredStripMeters

  return {
    doorCoverMm: DOOR_COVER_MM,
    adjustedDoorWidthMm,
    effectiveStripWidthMm,
    stripCount,
    hangerCount,
    stripsPerHanger,
    stripLengthMm,
    stripMeters,
    requiredStripMeters,
    billableStripMeters,
    rollLengthM: ROLL_LENGTH_M,
    rollCount,
    actualStripMeters,
  }
}

export function calculateHardware(
  input: PVCCalculatorInput,
  stripCount: number,
  hangerCount: number,
  rivetsPerStripOverride?: number | null,
): PVCHardwareResult {
  const rivetsPerStrip = Number.isFinite(rivetsPerStripOverride)
    ? Number(rivetsPerStripOverride)
    : RIVETS_PER_STRIP[input.stripWidth]

  if (!rivetsPerStrip) {
    throw new Error(`Unsupported strip width for rivet mapping: ${input.stripWidth}`)
  }

  return {
    headrailLengthMm: input.openingWidthMm + HEADRAIL_ALLOWANCE_MM,
    bracketCount: stripCount,
    rivetsPerStrip,
    rivetCount: hangerCount * rivetsPerStrip,
  }
}

export function calculateLabour(
  input: PVCCalculatorInput,
  hangerCount: number,
  settings: PVCPricingSettings,
): PVCLabourResult {
  if (input.installationType === 'supply_only') {
    return {
      stripMinutes: 0,
      ribbedMinutes: 0,
      labourFactor: 0,
      labourHours: 0,
      labourCost: 0,
      ribbedLabourCost: 0,
    }
  }

  const stripMinutes = hangerCount * settings.labour_minutes_per_strip
  const headrailMinutes = settings.minutes_per_headrail
  const setupMinutes = settings.install_setup_minutes ?? 6
  const totalMinutes = stripMinutes + headrailMinutes + setupMinutes
  const labourHours = round2(totalMinutes / 60)
  const labourCost = round2(labourHours * settings.labour_rate_per_hour)

  return {
    stripMinutes,
    ribbedMinutes: 0,
    labourFactor: settings.labour_rate_per_hour,
    labourHours,
    labourCost,
    ribbedLabourCost: 0,
  }
}

export function calculatePVCQuote(
  input: PVCCalculatorInput,
  settings: PVCPricingSettings,
  prices: PVCPricingPriceSelection,
): PVCCalculationResponse {
  const stripLayout = calculateStripLayout(input)
  const hardware = calculateHardware(input, stripLayout.stripCount, stripLayout.hangerCount, prices.rivetsPerStrip)
  const labour = calculateLabour(input, stripLayout.hangerCount, settings)

  const projectedStripMeters = stripLayout.requiredStripMeters
  const stripMeters = stripLayout.billableStripMeters
  const stripCost = round2(stripMeters * prices.stripUnitPrice)
  const headrailMetersRaw = hardware.headrailLengthMm / 1000
  const headrailCost = round2(headrailMetersRaw * prices.headrailUnitPrice)
  const bracketCost = round2(hardware.bracketCount * prices.bracketUnitPrice)
  const rivetCost = round2(hardware.rivetCount * prices.rivetUnitPrice)
  const labourCost = round2(labour.labourCost)
  const totalLabourCost = round2(labourCost)
  const packagingCost = round2(prices.packagingUnitPrice)

  const materialTotal = round2(stripCost + headrailCost + bracketCost + rivetCost + packagingCost)
  const subtotal = round2(materialTotal + totalLabourCost)
  const finalPrice = round2(subtotal * settings.markup_multiplier)

  const lineItems: PVCQuoteLineItem[] = [
    {
      key: 'strip',
      material: 'PVC Strip Material',
      productId: prices.stripProductId,
      quantity: round2(stripMeters),
      unitPrice: round2(prices.stripUnitPrice),
      lineTotal: round2(stripCost),
      unit: 'm',
    },
    {
      key: 'headrail',
      material: 'Headrail',
      productId: prices.headrailProductId,
      quantity: round2(headrailMetersRaw),
      unitPrice: round2(prices.headrailUnitPrice),
      lineTotal: round2(headrailMetersRaw * prices.headrailUnitPrice),
      unit: 'm',
    },
    createLineItem('bracket', 'Hanger / Brackets', prices.bracketProductId, hardware.bracketCount, prices.bracketUnitPrice, 'ea'),
    createLineItem('fitting', 'Rivets / Fittings', prices.fittingProductId, hardware.rivetCount, prices.rivetUnitPrice, 'ea'),
    createLineItem('packaging', 'Packaging Tube', prices.packagingProductId, 1, prices.packagingUnitPrice, 'ea'),
  ]

  if (input.installationType === 'supply_install') {
    lineItems.push(
      createLineItem('labour', 'Labour', prices.labourProductId, labour.labourHours, settings.labour_rate_per_hour, 'hr'),
    )
  }

  return {
    breakdown: {
      stripCount: stripLayout.stripCount,
      hangerWidth: input.hangerWidthMm,
      stripsPerHanger: stripLayout.stripsPerHanger,
      hangerCount: stripLayout.hangerCount,
      stripLength: round2(stripLayout.stripLengthMm),
      stripMeters: round2(stripLayout.billableStripMeters),
      requiredStripMeters: round2(stripLayout.requiredStripMeters),
      billableStripMeters: round2(stripLayout.billableStripMeters),
      projectedStripMeters: round2(projectedStripMeters),
      rollCount: stripLayout.rollCount,
      actualStripMeters: round2(stripLayout.actualStripMeters),
      headrailLength: round2(hardware.headrailLengthMm),
      bracketCount: hardware.bracketCount,
      rivetCount: hardware.rivetCount,
      labourHours: round2(labour.labourHours),
      ribbedLabourCost: 0,
      stripCost: round2(stripCost),
      headrailCost: round2(headrailCost),
      bracketCost: round2(bracketCost),
      hangerCost: round2(bracketCost),
      rivetCost: round2(rivetCost),
      labourCost: totalLabourCost,
      packagingCost: round2(packagingCost),
      subtotal,
      finalPrice,
      stripMaterialCost: round2(stripCost),
      fittingCost: round2(rivetCost),
    },
    totals: {
      subtotal,
      marginPercent: round2((settings.markup_multiplier - 1) * 100),
      finalPrice,
    },
    lineItems,
  }
}
