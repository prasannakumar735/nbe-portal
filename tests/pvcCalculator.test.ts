import type { SupabaseClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePVCQuote } from '@/lib/calculators/pvcPricingEngine'
import { generateQuote } from '@/lib/services/pvcCalculator.service'

type TableRows = Record<string, Array<Record<string, unknown>>>

function createMockSupabase(rows: TableRows): SupabaseClient {
  return {
    from(table: string) {
      return {
        async select() {
          return {
            data: rows[table] ?? [],
            error: null,
          }
        },
      }
    },
  } as unknown as SupabaseClient
}

const excelSettingsRows = [
  { setting_key: 'door_cover_mm', setting_value: '50' },
  { setting_key: 'headrail_allowance_mm', setting_value: '0' },
  { setting_key: 'height_adjust_mm', setting_value: '40' },
  { setting_key: 'strip_loading_waste_percent', setting_value: '5' },
  { setting_key: 'roll_length_m', setting_value: '50' },
  { setting_key: 'material_billing_mode', setting_value: 'part_materials' },
  { setting_key: 'labour_minutes_per_strip', setting_value: '2' },
  { setting_key: 'minutes_per_headrail', setting_value: '12.5' },
  { setting_key: 'ribbed_minutes_per_strip', setting_value: '1' },
  { setting_key: 'install_setup_minutes', setting_value: '0' },
  { setting_key: 'labour_rate_per_hour', setting_value: '30' },
  { setting_key: 'markup_percent', setting_value: '130' },
]

test('PVC calculator matches Excel reference door (1500 x 2100)', async () => {
  const mockSupabase = createMockSupabase({
    pvc_calculator_settings: excelSettingsRows,
    pvc_products: [
      { id: 'strip', product_code: 'PVCZ010705', product_name: 'PVC Strip Rib Pol 100mm x 2mm  M', category: 'strip', sub_category: 'p_r', unit_type: 'm', cost_price: '1.45', sell_price: '1.45' },
      { id: 'headrail', product_code: 'PVHZ010105', product_name: 'Head Rail Galvinized  360', category: 'headrail', sub_category: 'galvanized', unit_type: 'm', cost_price: '17', sell_price: '17' },
      { id: 'bracket', product_code: 'PVHZ010125', product_name: 'Hanger', category: 'hanger', sub_category: 'galvanized', unit_type: 'ea', cost_price: '2.15', sell_price: '2.15' },
      { id: 'rivet', product_code: 'HDWZ011395', product_name: 'Alum Rivet', category: 'fitting', sub_category: 'rivet', unit_type: 'ea', cost_price: '0.0388', sell_price: '0.0388' },
      { id: 'labour', product_code: 'LABOUR', product_name: 'Labour', category: 'labour', sub_category: 'install', unit_type: 'hr', cost_price: '30', sell_price: '30' },
      { id: 'packaging', product_code: 'PACZ010150', product_name: 'Packaging Tube', category: 'packaging', sub_category: 'tube', unit_type: 'ea', cost_price: '3.81', sell_price: '3.81' },
    ],
    pvc_strip_specs: [
      { product_id: 'strip', strip_width_mm: 100, thickness_mm: 2, material_grade: 'polar', surface_type: 'ribbed' },
    ],
    pvc_headrails: [
      { headrail_type: 'galvanized', product_id: 'headrail' },
    ],
    pvc_brackets: [
      { headrail_type: 'galvanized', hanger_width_mm: 150, product_id: 'bracket' },
    ],
    pvc_fittings: [
      { headrail_type: 'galvanized', hanger_width_mm: 150, strip_width_mm: 150, product_id: 'rivet', rivets_per_strip: 3 },
    ],
    pvc_labour_rates: [
      { install_type: 'supply_install', product_id: 'labour' },
    ],
    pvc_packaging: [
      { product_id: 'packaging' },
    ],
  })

  const result = await generateQuote(mockSupabase, {
    openingWidthMm: 1500,
    openingHeightMm: 2100,
    stripType: 'ribbed_polar',
    stripWidth: 100,
    stripThicknessMm: 2,
    overlapMm: 50,
    hangerWidthMm: 150,
    stripsPerHanger: 2,
    headrailType: 'galvanized',
    installationType: 'supply_install',
  })

  assert.equal(result.breakdown.stripCount, 11)
  assert.ok(Math.abs(result.breakdown.stripLength - 2140) < 0.01)
  assert.ok(Math.abs(result.breakdown.actualStripMeters - 23.54) < 0.01)
  assert.ok(Math.abs(result.breakdown.subtotal - 151.21) < 0.05)
  // Excel marks up the full subtotal, including ribbed labour — no carve-out (see pvcPricingEngine.ts).
  assert.ok(Math.abs(result.totals.finalPrice - 347.78) < 0.05)
})

test('PVC pricing engine strip layout uses hanger spacing from Excel', () => {
  const result = calculatePVCQuote(
    {
      openingWidthMm: 1500,
      openingHeightMm: 2100,
      stripType: 'ribbed_polar',
      stripWidth: 100,
      stripThicknessMm: 2,
      overlapMm: 50,
      hangerWidthMm: 150,
      stripsPerHanger: 2,
      headrailType: 'galvanized',
      installationType: 'supply_install',
    },
    {
      door_cover_mm: 50,
      headrail_allowance_mm: 0,
      height_adjust_mm: 40,
      strip_loading_waste_percent: 5,
      roll_length_m: 50,
      material_billing_mode: 'part_materials',
      labour_minutes_per_strip: 2,
      minutes_per_headrail: 12.5,
      ribbed_minutes_per_strip: 1,
      install_setup_minutes: 0,
      labour_rate_per_hour: 30,
      markup_percent: 130,
    },
    {
      stripProductId: 'strip',
      headrailProductId: 'headrail',
      bracketProductId: 'bracket',
      fittingProductId: 'rivet',
      labourProductId: 'labour',
      packagingProductId: 'packaging',
      stripUnitPrice: 1.45,
      headrailUnitPrice: 17,
      bracketUnitPrice: 2.15,
      rivetUnitPrice: 0.0388,
      rivetsPerStrip: 3,
      packagingUnitPrice: 3.81,
    },
  )

  assert.equal(result.breakdown.stripCount, 11)
  assert.ok(Math.abs(result.breakdown.headrailLength - 1650) < 0.01)
})

test('PVC strips only excludes only the headrail bar/labour, still bills brackets and rivets', () => {
  const settings = {
    door_cover_mm: 50,
    headrail_allowance_mm: 0,
    height_adjust_mm: 40,
    strip_loading_waste_percent: 5,
    roll_length_m: 50,
    material_billing_mode: 'part_materials' as const,
    labour_minutes_per_strip: 2,
    minutes_per_headrail: 12.5,
    ribbed_minutes_per_strip: 1,
    install_setup_minutes: 0,
    labour_rate_per_hour: 30,
    markup_percent: 130,
  }
  const prices = {
    stripProductId: 'strip',
    headrailProductId: 'headrail',
    bracketProductId: 'bracket',
    fittingProductId: 'rivet',
    labourProductId: 'labour',
    packagingProductId: 'packaging',
    stripUnitPrice: 1.45,
    headrailUnitPrice: 17,
    bracketUnitPrice: 2.15,
    rivetUnitPrice: 0.0388,
    rivetsPerStrip: 3,
    packagingUnitPrice: 3.81,
  }
  const baseInput = {
    openingWidthMm: 1500,
    openingHeightMm: 2100,
    stripType: 'ribbed_polar' as const,
    stripWidth: 100 as const,
    stripThicknessMm: 2,
    overlapMm: 50 as const,
    hangerWidthMm: 150 as const,
    stripsPerHanger: 2 as const,
    headrailType: 'galvanized' as const,
    installationType: 'supply_install' as const,
  }

  const wholeDoor = calculatePVCQuote({ ...baseInput, doorType: 'whole_door' }, settings, prices)
  const stripsOnly = calculatePVCQuote({ ...baseInput, doorType: 'strips_only' }, settings, prices)

  assert.ok(wholeDoor.breakdown.headrailCost > 0)
  assert.ok(wholeDoor.breakdown.bracketCost > 0)
  assert.ok(wholeDoor.breakdown.rivetCost > 0)
  // Excel only gates the headrail bar (and its assembly labour) on whole-door vs strips-only —
  // brackets/hangers and rivets are needed to hang the strips either way, so they're billed the same.
  assert.equal(stripsOnly.breakdown.headrailCost, 0)
  assert.equal(stripsOnly.breakdown.bracketCost, wholeDoor.breakdown.bracketCost)
  assert.equal(stripsOnly.breakdown.rivetCost, wholeDoor.breakdown.rivetCost)
  assert.equal(stripsOnly.breakdown.stripCount, wholeDoor.breakdown.stripCount)
  assert.ok(stripsOnly.totals.finalPrice < wholeDoor.totals.finalPrice)
})

test('PVC pricing engine matches Excel overlap layout (1800 x 3100, 150 mm strip)', () => {
  const result = calculatePVCQuote(
    {
      openingWidthMm: 1800,
      openingHeightMm: 3100,
      stripType: 'ribbed',
      stripWidth: 150,
      stripThicknessMm: 2,
      overlapMm: 50,
      hangerWidthMm: 150,
      stripsPerHanger: 1,
      headrailType: 'galvanized',
      installationType: 'supply_only',
    },
    {
      door_cover_mm: 50,
      headrail_allowance_mm: 0,
      height_adjust_mm: 40,
      strip_loading_waste_percent: 5,
      roll_length_m: 50,
      material_billing_mode: 'part_materials',
      labour_minutes_per_strip: 2,
      minutes_per_headrail: 12.5,
      ribbed_minutes_per_strip: 1,
      install_setup_minutes: 0,
      labour_rate_per_hour: 30,
      markup_percent: 130,
    },
    {
      stripProductId: 'strip',
      headrailProductId: 'headrail',
      bracketProductId: 'bracket',
      fittingProductId: 'rivet',
      labourProductId: 'labour',
      packagingProductId: 'packaging',
      stripUnitPrice: 2.06,
      headrailUnitPrice: 17,
      bracketUnitPrice: 2.15,
      rivetUnitPrice: 0.04,
      rivetsPerStrip: 3,
      packagingUnitPrice: 3.81,
    },
  )

  assert.equal(result.breakdown.stripCount, 19)
  assert.ok(Math.abs(result.breakdown.actualStripMeters - 59.66) < 0.05)
  assert.ok(Math.abs(result.breakdown.headrailLength - 1950) < 0.01)
  assert.ok(Math.abs(result.totals.retailBeforeInstallation - 560.92) < 0.05)
})

const excelSettings200mm = {
  door_cover_mm: 50,
  headrail_allowance_mm: 0,
  height_adjust_mm: 40,
  strip_loading_waste_percent: 5,
  roll_length_m: 50,
  material_billing_mode: 'part_materials' as const,
  labour_minutes_per_strip: 2,
  minutes_per_headrail: 12.5,
  ribbed_minutes_per_strip: 1,
  install_setup_minutes: 0,
  labour_rate_per_hour: 30,
  markup_percent: 130,
}

test('PVC pricing engine matches a real customer proposal (2650 x 2550, 200mm strip)', () => {
  // Verified against a live Excel proposal for this exact door (Unit Cost $659.59).
  const result = calculatePVCQuote(
    {
      openingWidthMm: 2650,
      openingHeightMm: 2550,
      stripType: 'ribbed',
      stripWidth: 200,
      stripThicknessMm: 2,
      overlapMm: 50,
      hangerWidthMm: 200,
      stripsPerHanger: 1,
      headrailType: 'galvanized',
      installationType: 'supply_only',
      doorType: 'whole_door',
    },
    excelSettings200mm,
    {
      stripProductId: 'strip',
      headrailProductId: 'headrail',
      bracketProductId: 'bracket',
      fittingProductId: 'rivet',
      labourProductId: 'labour',
      packagingProductId: 'packaging',
      stripUnitPrice: 3.17,
      headrailUnitPrice: 17,
      bracketUnitPrice: 2.5,
      rivetUnitPrice: 0.04,
      rivetsPerStrip: 4,
      packagingUnitPrice: 3.81,
    },
  )

  assert.equal(result.breakdown.stripCount, 18)
  assert.ok(Math.abs(result.breakdown.headrailLength - 2750) < 0.01)
  assert.ok(Math.abs(result.totals.finalPrice - 659.59) < 0.5)
})

test('PVC strips only still bills brackets/rivets against a real customer proposal (2300 x 2130, 150mm strip)', () => {
  // Verified against a live Excel "Strips Only" proposal for this exact door (Unit Cost $475.76).
  const result = calculatePVCQuote(
    {
      openingWidthMm: 2300,
      openingHeightMm: 2130,
      stripType: 'ribbed',
      stripWidth: 150,
      stripThicknessMm: 2,
      overlapMm: 50,
      hangerWidthMm: 150,
      stripsPerHanger: 1,
      headrailType: 'galvanized',
      installationType: 'supply_only',
      doorType: 'strips_only',
    },
    excelSettings200mm,
    {
      stripProductId: 'strip',
      headrailProductId: 'headrail',
      bracketProductId: 'bracket',
      fittingProductId: 'rivet',
      labourProductId: 'labour',
      packagingProductId: 'packaging',
      stripUnitPrice: 2.06,
      headrailUnitPrice: 17,
      bracketUnitPrice: 2.15,
      rivetUnitPrice: 0.04,
      rivetsPerStrip: 3,
      packagingUnitPrice: 3.81,
    },
  )

  assert.equal(result.breakdown.stripCount, 24)
  assert.equal(result.breakdown.headrailCost, 0)
  assert.ok(result.breakdown.bracketCost > 0)
  assert.ok(result.breakdown.rivetCost > 0)
  assert.ok(Math.abs(result.totals.finalPrice - 475.76) < 0.5)
})

test('PVC calculator uses Nuts/Bolts/Washers (not rivets) and no slotted bracket for aluminium headrails', async () => {
  const mockSupabase = createMockSupabase({
    pvc_calculator_settings: excelSettingsRows,
    pvc_products: [
      { id: 'strip', product_code: 'PVCZ010120', product_name: 'PVC Strip Std 200mm x 2mm', category: 'strip', sub_category: 'p', unit_type: 'm', cost_price: '3.8', sell_price: '3.8' },
      { id: 'headrail', product_code: 'PVHZ010110', product_name: 'Head Rail Aluminium 6500mm', category: 'headrail', sub_category: 'aluminium', unit_type: 'm', cost_price: '3.8', sell_price: '3.8' },
      { id: 'nut', product_code: 'HDWZ010105', product_name: 'Nut M6 ZP', category: 'fitting', sub_category: 'hardware', cost_price: '0.03', sell_price: '0.03' },
      { id: 'bolt', product_code: 'HDWZ010405', product_name: 'Bolt M6 x 15 ZP', category: 'fitting', sub_category: 'hardware', cost_price: '0.08', sell_price: '0.08' },
      { id: 'washer', product_code: 'HDWZ010905', product_name: 'Washer M6 ZP', category: 'fitting', sub_category: 'hardware', cost_price: '0.01', sell_price: '0.01' },
      { id: 'labour', product_code: 'LABOUR', product_name: 'Labour', category: 'labour', sub_category: 'install', unit_type: 'hr', cost_price: '30', sell_price: '30' },
      { id: 'packaging', product_code: 'PACZ010150', product_name: 'Packaging Tube', category: 'packaging', sub_category: 'tube', unit_type: 'ea', cost_price: '3.81', sell_price: '3.81' },
    ],
    pvc_strip_specs: [
      { product_id: 'strip', strip_width_mm: 200, thickness_mm: 2, material_grade: 'standard', surface_type: 'smooth' },
    ],
    pvc_headrails: [
      { headrail_type: 'aluminium', product_id: 'headrail' },
    ],
    pvc_brackets: [],
    pvc_fittings: [
      { fitting_type: 'nut', product_id: 'nut', rivets_per_strip: 4 },
      { fitting_type: 'bolt', product_id: 'bolt', rivets_per_strip: 4 },
      { fitting_type: 'washer', product_id: 'washer', rivets_per_strip: 4 },
    ],
    pvc_labour_rates: [
      { install_type: 'supply_only', product_id: 'labour' },
    ],
    pvc_packaging: [
      { product_id: 'packaging' },
    ],
  })

  const result = await generateQuote(mockSupabase, {
    openingWidthMm: 2000,
    openingHeightMm: 2100,
    stripType: 'standard',
    stripWidth: 200,
    stripThicknessMm: 2,
    overlapMm: 50,
    hangerWidthMm: 200,
    stripsPerHanger: 1,
    headrailType: 'aluminium',
    installationType: 'supply_only',
  })

  // No slotted bracket exists for aluminium in Excel — cost is 0, and rivets are replaced by
  // a combined Nut + Bolt + Washer fastener at the same per-hanger-width quantity as rivets.
  assert.equal(result.breakdown.bracketCost, 0)
  assert.ok(Math.abs(result.breakdown.rivetCost - result.breakdown.stripCount * 4 * 0.12) < 0.05)
})
