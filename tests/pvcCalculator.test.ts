import type { SupabaseClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import test from 'node:test'
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

test('PVC calculator reference case', async () => {
  const mockSupabase = createMockSupabase({
    pvc_calculator_settings: [
      { setting_key: 'labour_minutes_per_strip', setting_value: '2' },
      { setting_key: 'minutes_per_headrail', setting_value: '12.5' },
      { setting_key: 'install_setup_minutes', setting_value: '6' },
      { setting_key: 'labour_rate_per_hour', setting_value: '30' },
      { setting_key: 'markup_multiplier', setting_value: '2.3' },
    ],
    pvc_products: [
      { id: 'strip', product_code: 'STRIP-100-RIB', product_name: 'PVC Strip Ribbed 100x2', category: 'strip', sub_category: 'pvc', unit_type: 'm', cost_price: '1.5', sell_price: '1.76' },
      { id: 'headrail', product_code: 'HEAD-GALV', product_name: 'Headrail Galvanized', category: 'headrail', sub_category: 'galvanized', unit_type: 'm', cost_price: '11.5', sell_price: '11.5' },
      { id: 'bracket', product_code: 'HANGER-150', product_name: 'Hanger / Bracket', category: 'hanger', sub_category: 'galvanized', unit_type: 'ea', cost_price: '4', sell_price: '4' },
      { id: 'rivet', product_code: 'RIVET-100', product_name: 'Rivet', category: 'fitting', sub_category: 'rivet', unit_type: 'ea', cost_price: '1.8', sell_price: '1.8' },
      { id: 'labour', product_code: 'LABOUR', product_name: 'Labour', category: 'labour', sub_category: 'install', unit_type: 'hr', cost_price: '30', sell_price: '30' },
      { id: 'packaging', product_code: 'PACK', product_name: 'Packaging Tube', category: 'packaging', sub_category: 'tube', unit_type: 'ea', cost_price: '32.91', sell_price: '32.91' },
    ],
    pvc_strip_specs: [
      { product_id: 'strip', strip_width_mm: 100, thickness_mm: 2, material_grade: 'standard', surface_type: 'ribbed' },
    ],
    pvc_headrails: [
      { headrail_type: 'Galvanized', product_id: 'headrail' },
    ],
    pvc_brackets: [
      { headrail_type: 'Galvanized', product_id: 'bracket' },
    ],
    pvc_fittings: [
      { strip_width_mm: 100, product_id: 'rivet', rivets_per_strip: 2 },
    ],
    pvc_labour_rates: [
      { install_type: 'supply_install', product_id: 'labour' },
    ],
    pvc_packaging: [
      { product_id: 'packaging' },
    ],
  })

  const result = await generateQuote(mockSupabase, {
    openingWidthMm: 3000,
    openingHeightMm: 2500,
    stripType: 'ribbed',
    stripWidth: 100,
    stripThicknessMm: 2,
    overlapMm: 15,
    hangerWidthMm: 150,
    stripsPerHanger: 2,
    headrailType: 'galvanized',
    installationType: 'supply_install',
  })

  assert.ok(Math.abs(result.totals.subtotal - 306.24) < 0.01)
  assert.ok(Math.abs(result.totals.finalPrice - 704.35) < 0.01)
})
