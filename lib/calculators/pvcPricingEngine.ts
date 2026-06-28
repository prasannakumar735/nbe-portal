import type {
  PVCCalculationResponse,
  PVCCalculatorInput,
  PVCHardwareResult,
  PVCLabourResult,
  PVCHeadrailType,
  PVCQuoteLineItem,
  PVCStripLayoutResult,
  PVCStripType,
} from '@/lib/types/pvc.types'

export const PVC_CALCULATOR_VERSION = '2.0.0'

/**
 * Item labels used in `calculatePVCQuote` line items and the PVC quote PDF (Material & Cost table).
 */
export const PVC_STRIP_QUOTE_LINE_MATERIAL_LABELS = [
  'PVC Strip Material',
  'Headrail',
  'Hanger / Brackets',
  'Rivets / Fittings',
  'Packaging Tube',
  'Manufacturing / Cutting Labour',
  'Installation',
  'Freight',
] as const

function resolveFreightAmount(input: PVCCalculatorInput): number {
  const amount = round2(Math.max(0, input.manualFreightPrice ?? 0))
  if (amount <= 0) return 0
  if (input.installationType === 'supply_only') return amount
  return input.freightRequired ? amount : 0
}

export type PVCMaterialBillingMode = 'part_materials' | 'full_materials'

export type PVCPricingSettings = {
  door_cover_mm: number
  headrail_allowance_mm: number
  height_adjust_mm: number
  strip_loading_waste_percent: number
  roll_length_m: number
  material_billing_mode: PVCMaterialBillingMode
  labour_minutes_per_strip: number
  minutes_per_headrail: number
  ribbed_minutes_per_strip: number
  install_setup_minutes: number
  labour_rate_per_hour: number
  markup_percent: number
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

const STRIP_MINUTES_BY_HEADRAIL: Record<PVCHeadrailType, number> = {
  stainless: 2,
  galvanized: 2,
  aluminium: 2.5,
  plastic: 2.25,
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function getHeightAdjustMm(input: PVCCalculatorInput, settings: PVCPricingSettings): number {
  if (settings.height_adjust_mm > 0) {
    return settings.height_adjust_mm
  }

  switch (input.headrailType) {
    case 'stainless':
      return -15
    case 'galvanized':
    case 'aluminium':
      return 40
    case 'plastic':
      return 20
    default:
      return 40
  }
}

function isRibbedProfile(stripType: PVCStripType): boolean {
  return stripType === 'ribbed' || stripType === 'ribbed_polar'
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

function isWholeDoorSupply(input: PVCCalculatorInput): boolean {
  return (input.doorType ?? 'whole_door') !== 'strips_only'
}

function getDoorCoverPerSideMm(input: PVCCalculatorInput, settings: PVCPricingSettings): number {
  if (input.stripWidth === 100) {
    return settings.door_cover_mm
  }
  return input.stripWidth / 2
}

/** Excel: 100 mm curtains use hanger spacing; wider strips use overlap advance (strip width − overlap). */
export function calculateExcelStripCount(totalDoorWidthMm: number, input: PVCCalculatorInput): number {
  if (input.stripWidth === 100) {
    const stripSpacingMm = input.hangerWidthMm
    const firstStripWidthMm = input.hangerWidthMm
    const remainingWidthMm = Math.max(totalDoorWidthMm - firstStripWidthMm, 0)
    const leadingStripUnits = firstStripWidthMm / stripSpacingMm
    const remainingStripUnits = remainingWidthMm / stripSpacingMm
    return Math.ceil(leadingStripUnits + remainingStripUnits)
  }

  const stripCoverMm = input.stripWidth - input.overlapMm
  if (stripCoverMm <= 0) {
    return Math.ceil(totalDoorWidthMm / Math.max(input.stripWidth, 1))
  }

  const firstStripMm = input.stripWidth
  const remainingWidthMm = Math.max(totalDoorWidthMm - firstStripMm, 0)
  return 1 + Math.ceil(remainingWidthMm / stripCoverMm)
}

export function calculateStripLayout(
  input: PVCCalculatorInput,
  settings: PVCPricingSettings,
): PVCStripLayoutResult {
  const stripsPerHanger =
    input.stripWidth === 100 ? (input.stripsPerHanger || (input.hangerWidthMm === 150 ? 2 : 1)) : 1

  const doorCoverPerSideMm = getDoorCoverPerSideMm(input, settings)
  const totalDoorWidthMm = input.openingWidthMm + doorCoverPerSideMm * 2
  const stripSpacingMm = input.hangerWidthMm
  const stripCount = calculateExcelStripCount(totalDoorWidthMm, input)
  const stripCoverMm = input.stripWidth === 100 ? stripSpacingMm : input.stripWidth - input.overlapMm

  const heightAdjustMm = getHeightAdjustMm(input, settings)
  const stripLengthMm = input.openingHeightMm + heightAdjustMm
  const actualStripMeters = round2((stripCount * stripLengthMm) / 1000)

  const partMaterialMultiplier =
    settings.material_billing_mode === 'part_materials' ? stripsPerHanger : 1
  const projectedStripMeters = round2(actualStripMeters * partMaterialMultiplier)

  const wasteFactor = 1 + settings.strip_loading_waste_percent / 100
  const billableStripMeters = round2(projectedStripMeters * wasteFactor)

  const rollLengthM = settings.roll_length_m
  const rollCount = Math.ceil(projectedStripMeters / rollLengthM)

  return {
    doorCoverMm: doorCoverPerSideMm,
    adjustedDoorWidthMm: totalDoorWidthMm,
    effectiveStripWidthMm: stripCoverMm > 0 ? stripCoverMm : stripSpacingMm,
    stripCount,
    hangerCount: Math.ceil(stripCount / stripsPerHanger),
    stripsPerHanger,
    stripLengthMm,
    stripMeters: actualStripMeters,
    requiredStripMeters: projectedStripMeters,
    billableStripMeters,
    rollLengthM,
    rollCount,
    actualStripMeters,
  }
}

export function calculateHardware(
  input: PVCCalculatorInput,
  stripLayout: PVCStripLayoutResult,
  settings: PVCPricingSettings,
  rivetsPerStripOverride?: number | null,
): PVCHardwareResult {
  const stripSpacingMm = input.hangerWidthMm
  const remainingWidthMm = Math.max(stripLayout.adjustedDoorWidthMm - input.hangerWidthMm, 0)
  const remainingStripUnits = remainingWidthMm / stripSpacingMm
  const roundedRemainingStrips = Math.ceil(remainingStripUnits)
  const excelHeadrailLengthMm = input.hangerWidthMm + stripSpacingMm * roundedRemainingStrips

  const rivetsPerStrip = Number.isFinite(rivetsPerStripOverride)
    ? Number(rivetsPerStripOverride)
    : null

  if (rivetsPerStrip === null || rivetsPerStrip <= 0) {
    throw new Error(`Missing rivets_per_strip mapping for hanger width ${input.hangerWidthMm}mm`)
  }

  return {
    headrailLengthMm: excelHeadrailLengthMm,
    bracketCount: stripLayout.stripCount,
    rivetsPerStrip,
    rivetCount: stripLayout.stripCount * rivetsPerStrip,
  }
}

export function calculateLabour(
  input: PVCCalculatorInput,
  stripCount: number,
  settings: PVCPricingSettings,
): PVCLabourResult {
  const stripMinutesPerStrip =
    STRIP_MINUTES_BY_HEADRAIL[input.headrailType] ?? settings.labour_minutes_per_strip
  const stripMinutes = stripCount * stripMinutesPerStrip
  const ribbedMinutes = isRibbedProfile(input.stripType)
    ? stripCount * settings.ribbed_minutes_per_strip
    : 0
  const headrailMinutes = isWholeDoorSupply(input) ? settings.minutes_per_headrail : 0
  const setupMinutes = isWholeDoorSupply(input) ? (settings.install_setup_minutes ?? 0) : 0
  const totalMinutes = stripMinutes + ribbedMinutes + headrailMinutes + setupMinutes
  const labourHours = totalMinutes / 60
  const labourCost = round2(labourHours * settings.labour_rate_per_hour)
  const ribbedLabourCost = round2((ribbedMinutes / 60) * settings.labour_rate_per_hour)

  return {
    stripMinutes,
    ribbedMinutes,
    labourFactor: settings.labour_rate_per_hour,
    labourHours,
    labourCost,
    ribbedLabourCost,
  }
}

export function calculatePVCQuote(
  input: PVCCalculatorInput,
  settings: PVCPricingSettings,
  prices: PVCPricingPriceSelection,
): PVCCalculationResponse {
  const stripLayout = calculateStripLayout(input, settings)
  const hardware = calculateHardware(input, stripLayout, settings, prices.rivetsPerStrip)
  const labour = calculateLabour(input, stripLayout.stripCount, settings)
  const includeHeadrail = isWholeDoorSupply(input)

  const stripMeters = stripLayout.billableStripMeters
  const stripCost = round2(stripMeters * prices.stripUnitPrice)
  const headrailMetersRaw = includeHeadrail ? hardware.headrailLengthMm / 1000 : 0
  const headrailCost = includeHeadrail ? round2(headrailMetersRaw * prices.headrailUnitPrice) : 0
  const bracketCost = includeHeadrail ? round2(hardware.bracketCount * prices.bracketUnitPrice) : 0
  const rivetCost = includeHeadrail ? round2(hardware.rivetCount * prices.rivetUnitPrice) : 0
  const labourCost = round2(labour.labourCost)
  const packagingCost = round2(prices.packagingUnitPrice)

  const materialTotal = round2(stripCost + headrailCost + bracketCost + rivetCost + packagingCost)
  const subtotal = round2(materialTotal + labourCost)
  const markupMultiplier = 1 + settings.markup_percent / 100
  const ribbedLabourCost = round2(labour.ribbedLabourCost)
  const subtotalSubjectToMarkup = round2(subtotal - ribbedLabourCost)
  const retailBeforeInstallation = round2(subtotalSubjectToMarkup * markupMultiplier + ribbedLabourCost)
  const manualInstallation =
    input.installationType === 'supply_install' && Number.isFinite(input.manualInstallationPrice)
      ? round2(Math.max(0, input.manualInstallationPrice ?? 0))
      : 0
  const freightAmount = resolveFreightAmount(input)
  const finalPrice = round2(retailBeforeInstallation + manualInstallation + freightAmount)

  const lineItems: PVCQuoteLineItem[] = [
    createLineItem('strip', 'PVC Strip Material', prices.stripProductId, stripMeters, prices.stripUnitPrice, 'm'),
    createLineItem(
      'headrail',
      'Headrail',
      prices.headrailProductId,
      includeHeadrail ? headrailMetersRaw : 0,
      prices.headrailUnitPrice,
      'm',
    ),
    createLineItem(
      'bracket',
      'Hanger / Brackets',
      prices.bracketProductId,
      includeHeadrail ? hardware.bracketCount : 0,
      prices.bracketUnitPrice,
      'ea',
    ),
    createLineItem(
      'fitting',
      'Rivets / Fittings',
      prices.fittingProductId,
      includeHeadrail ? hardware.rivetCount : 0,
      prices.rivetUnitPrice,
      'ea',
    ),
    createLineItem('packaging', 'Packaging Tube', prices.packagingProductId, 1, prices.packagingUnitPrice, 'ea'),
  ]

  if (labourCost > 0) {
    lineItems.push(
      createLineItem(
        'labour',
        'Manufacturing / Cutting Labour',
        prices.labourProductId,
        round2(labour.labourHours),
        settings.labour_rate_per_hour,
        'hr',
      ),
    )
  }

  if (manualInstallation > 0) {
    lineItems.push(
      createLineItem('installation', 'Installation', null, 1, manualInstallation, 'ea'),
    )
  }

  if (freightAmount > 0) {
    lineItems.push(
      createLineItem('freight', 'Freight', null, 1, freightAmount, 'ea'),
    )
  }

  return {
    breakdown: {
      stripCount: stripLayout.stripCount,
      hangerWidth: input.hangerWidthMm,
      stripsPerHanger: stripLayout.stripsPerHanger,
      hangerCount: stripLayout.hangerCount,
      stripLength: round2(stripLayout.stripLengthMm),
      stripMeters: round2(stripLayout.actualStripMeters),
      requiredStripMeters: round2(stripLayout.requiredStripMeters),
      billableStripMeters: round2(stripLayout.billableStripMeters),
      projectedStripMeters: round2(stripLayout.requiredStripMeters),
      rollCount: stripLayout.rollCount,
      actualStripMeters: round2(stripLayout.actualStripMeters),
      headrailLength: round2(hardware.headrailLengthMm),
      bracketCount: hardware.bracketCount,
      rivetCount: hardware.rivetCount,
      labourHours: round2(labour.labourHours),
      ribbedLabourCost: round2(labour.ribbedLabourCost),
      stripCost: round2(stripCost),
      headrailCost: round2(headrailCost),
      bracketCost: round2(bracketCost),
      hangerCost: round2(bracketCost),
      rivetCost: round2(rivetCost),
      labourCost,
      packagingCost: round2(packagingCost),
      subtotal,
      retailBeforeInstallation,
      installationCost: manualInstallation,
      freightCost: freightAmount,
      finalPrice,
      stripMaterialCost: round2(stripCost),
      fittingCost: round2(rivetCost),
    },
    totals: {
      subtotal,
      marginPercent: round2(settings.markup_percent),
      retailBeforeInstallation,
      installationPrice: manualInstallation,
      freightPrice: freightAmount,
      finalPrice,
    },
    lineItems,
  }
}
