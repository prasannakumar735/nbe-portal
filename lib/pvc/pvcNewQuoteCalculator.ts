/**
 * PVC Flex System — New Quotes Module calculator
 * Prices sourced from QPVC Excel template (2026). When inventory prices are
 * wired up, replace the lookup tables below with DB-fetched values using the
 * INVENTORY_PVC category (matching SKUs in admin/inventory/products).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PvcGrade         = 'Ambient' | 'Freezer'
export type PvcProfile       = 'Ribbed' | 'Flat' | 'Coloured'
export type PvcHanger        = 'Galvanised' | 'Stainless Steel'
export type PvcSupplyType    = 'Complete Door' | 'Strip Curtain Only' | 'Headrail Only'
export type PvcMountingType  = 'Face Fixed' | 'Soffit Fixed'
export type PvcSliding       = 'NA' | 'Single' | 'Dual'
export type PvcRaisedHeadrail = 'NA' | 'M' | 'L'

export interface PvcNewQuoteSpec {
  openingW:       number   // mm
  openingH:       number   // mm
  stripWidth:     number   // mm — 100 | 150 | 200 | 300 | 400
  thickness:      number   // mm — 2 | 3
  grade:          PvcGrade
  profile:        PvcProfile
  hanger:         PvcHanger
  supplyType:     PvcSupplyType
  mountingType:   PvcMountingType
  sliding:        PvcSliding
  raisedHeadrail: PvcRaisedHeadrail
}

export interface PvcNewQuoteResult {
  // Geometry
  pitch:              number   // mm
  numStrips:          number
  cutLengthMm:        number
  totalPvcLengthM:    number
  coverageM:          number   // headrail run length
  increments3m:       number   // 3-metre packaging/labour increments

  // Cost breakdown (manufacturing / cost price)
  pvcCostPerM:        number
  pvcCost:            number
  hangerCost:         number
  headrailCost:       number
  raisedHeadrailCost: number
  slidingCost:        number
  packagingCost:      number
  labourHours:        number
  labourCost:         number
  manufacturedCost:   number

  // Discountable "material" portion (PVC + hangers + headrail)
  materialCost:       number

  // Sell price (no discount applied here — discount is applied externally)
  sellPrice:          number   // manufacturedCost × 3
  grossMarginPct:     number   // 66.7%
}

// ── Price tables ──────────────────────────────────────────────────────────────
// All prices in AUD per metre or per set (cost price before markup).
// These are sourced from QPVC Excel. Replace with DB lookups once inventory
// prices are entered in admin → Inventory → Products (INVENTORY_PVC category).

/** PVC strip cost AUD/m  keyed as "width|thickness|grade" */
export const PVC_STRIP_COST_PER_M: Record<string, number> = {
  '100|2|Ambient':  0.6552,
  '100|2|Freezer':  0.6908,
  '150|2|Ambient':  0.9828,
  '150|2|Freezer':  1.0356,
  '200|2|Ambient':  1.3104,
  '200|2|Freezer':  1.3808,
  '200|3|Ambient':  1.9656,
  '200|3|Freezer':  2.0716,
  '300|3|Ambient':  2.9484,
  '300|3|Freezer':  3.1072,
  '400|3|Ambient':  3.9312,
  '400|3|Freezer':  4.142932,
}

/** Coloured PVC premium (100mm and 200mm only) keyed as "width|thickness" */
export const PVC_COLOURED_COST_PER_M: Record<string, number> = {
  '100|2': 0.6576,
  '200|2': 1.3152,
}

/** Headrail cost AUD/m */
export const HEADRAIL_COST_PER_M: Record<PvcHanger, number> = {
  'Galvanised':      7.426666667,
  'Stainless Steel': 16.08,
}

/** Hanger cost AUD/set keyed as "hangerWidth|material"
 *  100mm strip uses 150mm hanger; 400mm strip uses 300mm hanger */
export const HANGER_COST_PER_SET: Record<string, number> = {
  '150|Galvanised':      1.1158,
  '150|Stainless Steel': 1.5358,
  '200|Galvanised':      1.3347,
  '200|Stainless Steel': 1.87475,
  '300|Galvanised':      2.51265,
  '300|Stainless Steel': 2.73265,
}

/** Raised headrail manufactured cost per door */
export const RAISED_HEADRAIL_COST: Record<'M' | 'L', number> = {
  M: 229.84,
  L: 305.84,
}

/** Sliding track manufactured cost per door */
export const SLIDING_COST: Record<PvcSliding, number> = {
  NA:     0,
  Single: 372.63,
  Dual:   846.82,
}

// ── Fixed parameters ──────────────────────────────────────────────────────────

const SIDE_COVER_MM       = 50    // each side
const LENGTH_ALLOWANCE_MM = 40    // added to opening height
const PVC_WASTE_FACTOR    = 1.05  // 5% waste
const HEADRAIL_WASTE      = 1.20  // 20% over-order
const MARKUP              = 2     // sell = cost × (1 + MARKUP)
const PACKAGING_PER_3M    = 6     // AUD per 3-metre increment
const LABOUR_RATE         = 75    // AUD/hr
const PREP_MIN            = 15    // per door
const ASSEMBLY_MIN_PER_HANGER    = 3      // per hanger set
const HEADRAIL_MIN_PER_INCREMENT = 12.5   // per 3m increment
const SLIDING_MIN_PER_INCREMENT  = 12.5   // per 3m increment
const RAISED_HR_HOURS: Record<'M' | 'L', number> = { M: 3.5, L: 6 }
const RAISED_HR_THRESHOLD = 4500  // mm — below this: M size, above: L size

// ── Helpers ───────────────────────────────────────────────────────────────────

function pitchMm(stripWidth: number): number {
  return stripWidth === 100 ? 150 : stripWidth - 50
}

function hangerWidthForStrip(stripWidth: number): number {
  if (stripWidth === 100) return 150
  if (stripWidth === 400) return 300
  return stripWidth
}

function lookupPvcCostPerM(spec: PvcNewQuoteSpec): number {
  if (spec.profile === 'Coloured') {
    const key = `${spec.stripWidth}|${spec.thickness}`
    if (PVC_COLOURED_COST_PER_M[key]) return PVC_COLOURED_COST_PER_M[key]
  }
  return PVC_STRIP_COST_PER_M[`${spec.stripWidth}|${spec.thickness}|${spec.grade}`] ?? 0
}

// ── Main calculation ──────────────────────────────────────────────────────────

export function calcPvcNewQuote(spec: PvcNewQuoteSpec): PvcNewQuoteResult {
  const pitch       = pitchMm(spec.stripWidth)
  const numStrips   = Math.ceil((spec.openingW + SIDE_COVER_MM) / pitch)
  const cutLengthMm = spec.openingH + LENGTH_ALLOWANCE_MM
  const totalPvcLengthM = (numStrips * cutLengthMm) / 1000
  const coverageM   = (numStrips * pitch + 50) / 1000
  const increments3m = Math.ceil(coverageM / 3)

  const includeStrips   = spec.supplyType !== 'Headrail Only'
  const includeHeadrail = spec.supplyType !== 'Strip Curtain Only'

  // PVC strips
  const pvcCostPerM = lookupPvcCostPerM(spec)
  const pvcCost     = includeStrips ? totalPvcLengthM * PVC_WASTE_FACTOR * pvcCostPerM : 0

  // Hangers
  const hangerKey      = `${hangerWidthForStrip(spec.stripWidth)}|${spec.hanger}`
  const hangerCostPerSet = HANGER_COST_PER_SET[hangerKey] ?? 0
  const hangerCost     = includeStrips ? numStrips * hangerCostPerSet : 0

  // Headrail
  const headrailCost = includeHeadrail
    ? coverageM * HEADRAIL_WASTE * HEADRAIL_COST_PER_M[spec.hanger]
    : 0

  // Optional: raised headrail structure
  const raisedHeadrailCost = spec.raisedHeadrail !== 'NA'
    ? RAISED_HEADRAIL_COST[spec.raisedHeadrail]
    : 0

  // Optional: sliding system
  const slidingCost = SLIDING_COST[spec.sliding]

  // Packaging
  const packagingCost = increments3m * PACKAGING_PER_3M

  // Labour
  let labourHours = PREP_MIN / 60
  if (includeStrips)   labourHours += (numStrips * ASSEMBLY_MIN_PER_HANGER) / 60
  if (includeHeadrail) labourHours += (increments3m * HEADRAIL_MIN_PER_INCREMENT) / 60
  if (spec.sliding !== 'NA') labourHours += (increments3m * SLIDING_MIN_PER_INCREMENT) / 60
  if (spec.raisedHeadrail !== 'NA') labourHours += RAISED_HR_HOURS[spec.raisedHeadrail]
  const labourCost = labourHours * LABOUR_RATE

  const manufacturedCost = pvcCost + hangerCost + headrailCost + raisedHeadrailCost + slidingCost + packagingCost + labourCost
  const materialCost     = pvcCost + hangerCost + headrailCost
  const sellPrice        = manufacturedCost * (1 + MARKUP)

  return {
    pitch, numStrips, cutLengthMm, totalPvcLengthM, coverageM, increments3m,
    pvcCostPerM, pvcCost, hangerCost, headrailCost,
    raisedHeadrailCost, slidingCost, packagingCost, labourHours, labourCost,
    manufacturedCost, materialCost,
    sellPrice, grossMarginPct: MARKUP / (1 + MARKUP),
  }
}

/** Auto-determine raised headrail size from opening width */
export function autoRaisedHeadrailSize(openingW: number): 'M' | 'L' {
  return openingW >= RAISED_HR_THRESHOLD ? 'L' : 'M'
}

/** Available thickness options for a given strip width */
export function thicknessOptionsForWidth(stripWidth: number): number[] {
  if (stripWidth === 200) return [2, 3]
  if (stripWidth >= 300)  return [3]
  return [2]
}

/** Available profile options for a given width + grade */
export function profileOptionsForSpec(stripWidth: number, grade: PvcGrade): PvcProfile[] {
  if (grade === 'Freezer') return ['Ribbed']
  if (stripWidth === 100)  return ['Ribbed', 'Flat', 'Coloured']
  if (stripWidth === 200)  return ['Ribbed', 'Coloured']
  return ['Ribbed']
}

/** Compute the discounted unit sell price for one door item */
export function discountedSellPrice(
  spec: PvcNewQuoteSpec,
  calc: PvcNewQuoteResult,
  discountPct: number,
): number {
  const materialSell    = calc.materialCost * (1 + MARKUP)
  const nonMaterialSell = calc.sellPrice - materialSell
  const discountedMat   = materialSell * (1 - discountPct / 100)
  return discountedMat + nonMaterialSell
}

/** Human-readable spec description (multi-line) for PDF */
export function buildPvcDoorDescription(spec: PvcNewQuoteSpec, calc: PvcNewQuoteResult): string {
  const lines: string[] = [
    `Opening: ${spec.openingW} W × ${spec.openingH} H mm`,
    `Strip: ${spec.stripWidth}mm × ${spec.thickness}mm — ${spec.grade} / ${spec.profile}`,
    `${spec.hanger} hangers & headrail — ${spec.supplyType} — ${spec.mountingType}`,
  ]
  if (spec.sliding !== 'NA')       lines.push(`Sliding System: ${spec.sliding}`)
  if (spec.raisedHeadrail !== 'NA') lines.push(`Raised Headrail: ${spec.raisedHeadrail} (${spec.openingW >= 4500 ? '≥4500mm' : '<4500mm'})`)
  lines.push(`${calc.numStrips} strips × ${calc.cutLengthMm}mm cut length — Rail: ${calc.coverageM.toFixed(2)}m`)
  return lines.join('\n')
}
