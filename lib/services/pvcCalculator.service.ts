import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PVCCalculationResponse,
  PVCCalculatorInput,
  PVCStripType,
} from '@/lib/types/pvc.types'
import {
  calculatePVCQuote,
  PVC_CALCULATOR_VERSION,
  type PVCPricingPriceSelection,
  type PVCPricingSettings,
} from '@/lib/calculators/pvcPricingEngine'

type SettingRow = {
  setting_key: string
  setting_value: number | string | null
}

type ProductRow = {
  id: string
  product_code: string | null
  product_name: string | null
  category: string | null
  sub_category: string | null
  unit_type: string | null
  cost_price: number | string | null
  sell_price: number | string | null
}

type StripSpecRow = {
  product_id: string
  strip_width_mm: number
  thickness_mm: number
  material_grade: string | null
  surface_type: string | null
}

function selectByProductCode(products: ProductRow[], codes: string[]): ProductRow | null {
  const normalizedCodes = codes.map(code => normalize(code))
  return products.find(product => normalizedCodes.includes(normalize(product.product_code))) || null
}

function normalize(input: string | null | undefined): string {
  return (input || '').toLowerCase().trim()
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(/,/g, '').replace(/%/g, ''))
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export async function getCalculatorSettings(supabase: SupabaseClient): Promise<PVCPricingSettings> {
  const { data, error } = await supabase
    .from('pvc_calculator_settings')
    .select('setting_key, setting_value')

  if (error) throw error

  const settingsMap = Object.fromEntries(
    ((data || []) as SettingRow[]).map(setting => [setting.setting_key, Number(setting.setting_value)]),
  ) as Record<string, number>

  const pickPositive = (key: string, fallbackKey?: string): number => {
    const primary = settingsMap[key]
    const fallback = fallbackKey ? settingsMap[fallbackKey] : NaN
    const value = Number.isFinite(primary) ? primary : fallback

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Missing or invalid calculator setting in Supabase: ${key}`)
    }

    return value
  }

  const labourMinutesPerStrip = pickPositive('labour_minutes_per_strip', 'minutes_per_strip')
  const minutesPerHeadrail = pickPositive('minutes_per_headrail', 'headrail_minutes')
  const labourRatePerHour = pickPositive('labour_rate_per_hour', 'labour_hourly_rate')
  const markupMultiplier = pickPositive('markup_multiplier')
  const installSetupMinutes = Number.isFinite(settingsMap.install_setup_minutes)
    ? settingsMap.install_setup_minutes
    : 6

  if (!Number.isFinite(installSetupMinutes) || installSetupMinutes < 0) {
    throw new Error('Missing or invalid calculator setting in Supabase: install_setup_minutes')
  }

  return {
    labour_minutes_per_strip: labourMinutesPerStrip,
    minutes_per_headrail: minutesPerHeadrail,
    install_setup_minutes: installSetupMinutes,
    labour_rate_per_hour: labourRatePerHour,
    markup_multiplier: markupMultiplier,
  }
}

function includesAny(source: string, keywords: string[]): boolean {
  return keywords.some(keyword => source.includes(keyword))
}

function getStripTraits(stripType: PVCStripType): { material: string; surface: string } {
  switch (stripType) {
    case 'ribbed':
      return { material: 'standard', surface: 'ribbed' }
    case 'colour':
      return { material: 'colour', surface: 'smooth' }
    case 'polar':
      return { material: 'polar', surface: 'smooth' }
    case 'ribbed_polar':
      return { material: 'polar', surface: 'ribbed' }
    case 'standard':
    default:
      return { material: 'standard', surface: 'smooth' }
  }
}

function getHangerSku(hangerWidth: number): string | null {
  switch (hangerWidth) {
    case 100:
      return 'PVHZ010120'
    case 150:
      return 'PVHZ010125'
    case 200:
      return 'PVHZ010130'
    case 300:
      return 'PVHZ010135'
    default:
      return null
  }
}

function selectByCategory(products: ProductRow[], keywords: string[]): ProductRow | null {
  const scored = products
    .map(product => {
      const category = normalize(product.category)
      const subCategory = normalize(product.sub_category)
      const productName = normalize(product.product_name)

      const score =
        (includesAny(category, keywords) ? 3 : 0) +
        (includesAny(subCategory, keywords) ? 2 : 0) +
        (includesAny(productName, keywords) ? 1 : 0)

      return { product, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.product ?? null
}

function getValueFromRow(row: Record<string, unknown>, keys: string[]): unknown {
  const normalizedKeys = keys.map(key => normalize(key))

  for (const [columnName, value] of Object.entries(row)) {
    if (normalizedKeys.includes(normalize(columnName))) {
      return value
    }
  }

  return undefined
}

function rowMatches(row: Record<string, unknown>, keys: string[], expected: string): boolean {
  const value = getValueFromRow(row, keys)
  return normalize(String(value ?? '')) === normalize(expected)
}

function getProductFromRow(row: Record<string, unknown> | null, products: ProductRow[]): ProductRow | null {
  if (!row) return null

  const productId = String(getValueFromRow(row, ['product_id', 'pvc_product_id', 'item_id']) || '')
  if (!productId) return null

  return products.find(product => product.id === productId) || null
}

function getRowPrice(row: Record<string, unknown> | null, keys: string[]): number | null {
  if (!row) return null

  for (const key of keys) {
    const raw = getValueFromRow(row, [key])
    const numeric = toNumber(raw, NaN)
    if (Number.isFinite(numeric)) {
      return numeric
    }
  }

  return null
}

function resolveUnitPrice(
  product: ProductRow | null,
  row: Record<string, unknown> | null,
  material: string,
  rowKeys: string[] = ['cost_price', 'unit_price', 'price', 'rate', 'labour_rate'],
  requirePositive = false,
): number {
  const productPrice = toNumber(product?.cost_price, NaN)
  if (Number.isFinite(productPrice) && (!requirePositive || productPrice > 0)) {
    return productPrice
  }

  const rowPrice = getRowPrice(row, rowKeys)
  if (rowPrice !== null && Number.isFinite(rowPrice) && (!requirePositive || rowPrice > 0)) {
    return rowPrice
  }

  throw new Error(`Missing unit price in Supabase for ${material}.`)
}

export async function fetchProductPrices(
  supabase: SupabaseClient,
  input: PVCCalculatorInput,
): Promise<PVCPricingPriceSelection> {
  const [
    productsRes,
    stripSpecsRes,
    headrailsRes,
    bracketsRes,
    fittingsRes,
    labourRatesRes,
    packagingRes,
  ] = await Promise.all([
    supabase
      .from('pvc_products')
      .select('id, product_code, product_name, category, sub_category, unit_type, cost_price, sell_price'),
    supabase
      .from('pvc_strip_specs')
      .select('product_id, strip_width_mm, thickness_mm, material_grade, surface_type'),
    supabase.from('pvc_headrails').select('*'),
    supabase.from('pvc_brackets').select('*'),
    supabase.from('pvc_fittings').select('*'),
    supabase.from('pvc_labour_rates').select('*'),
    supabase.from('pvc_packaging').select('*'),
  ])

  if (productsRes.error) throw productsRes.error
  if (stripSpecsRes.error) throw stripSpecsRes.error
  if (headrailsRes.error) throw headrailsRes.error
  if (bracketsRes.error) throw bracketsRes.error
  if (fittingsRes.error) throw fittingsRes.error
  if (labourRatesRes.error) throw labourRatesRes.error
  if (packagingRes.error) throw packagingRes.error

  const products = (productsRes.data || []) as ProductRow[]
  const stripSpecs = (stripSpecsRes.data || []) as StripSpecRow[]
  const headrailRows = (headrailsRes.data || []) as Record<string, unknown>[]
  const bracketRows = (bracketsRes.data || []) as Record<string, unknown>[]
  const fittingRows = (fittingsRes.data || []) as Record<string, unknown>[]
  const labourRows = (labourRatesRes.data || []) as Record<string, unknown>[]
  const packagingRows = (packagingRes.data || []) as Record<string, unknown>[]

  const stripTraits = getStripTraits(input.stripType)
  const stripSpec = stripSpecs.find(spec => {
    const widthMatches = toNumber(spec.strip_width_mm) === input.stripWidth
    const thicknessMatches = toNumber(spec.thickness_mm) === input.stripThicknessMm
    const surfaceMatches = normalize(spec.surface_type) === stripTraits.surface

    return widthMatches && thicknessMatches && surfaceMatches
  })

  const stripProduct = products.find(product => product.id === stripSpec?.product_id)

  if (!stripProduct) {
    throw new Error(
      `No matching PVC strip product found for width ${input.stripWidth}mm thickness ${input.stripThicknessMm}mm type ${input.stripType}`,
    )
  }

  const headrailRow =
    headrailRows.find(row => rowMatches(row, ['headrail_type', 'type', 'material'], input.headrailType)) ||
    headrailRows[0] ||
    null
  const headrailProduct =
    getProductFromRow(headrailRow, products) ||
    selectByCategory(products, ['headrail', input.headrailType, 'rail'])

  const hangerSku = getHangerSku(input.hangerWidthMm)
  const hangerProductByCode = hangerSku ? selectByProductCode(products, [hangerSku]) : null

  const bracketRow =
    bracketRows.find(row => rowMatches(row, ['headrail_type', 'type', 'material'], input.headrailType)) ||
    bracketRows[0] ||
    null
  const bracketProduct =
    getProductFromRow(bracketRow, products) ||
    hangerProductByCode

  const fittingRow =
    fittingRows.find(row => {
      const width = toNumber(getValueFromRow(row, ['strip_width_mm', 'strip_width', 'width_mm', 'width']), NaN)
      return Number.isFinite(width) && width === input.stripWidth
    }) ||
    fittingRows[0] ||
    null
  const fittingProduct =
    getProductFromRow(fittingRow, products) ||
    selectByCategory(products, ['rivet', 'fitting', 'fastener'])

  const packagingRow = packagingRows[0] || null
  const packagingProduct =
    getProductFromRow(packagingRow, products) ||
    selectByCategory(products, ['packaging', 'tube', 'cardboard'])

  const labourRow =
    labourRows.find(row => rowMatches(row, ['install_type', 'installation_type', 'type'], input.installationType)) ||
    labourRows[0] ||
    null
  const labourProduct =
    getProductFromRow(labourRow, products) ||
    selectByCategory(products, ['labour', 'install'])

  const stripUnitPrice = toNumber(stripProduct?.sell_price, NaN)
  if (!Number.isFinite(stripUnitPrice) || stripUnitPrice <= 0) {
    throw new Error('Missing sell_price in Supabase for PVC Strip Material')
  }
  const headrailUnitPrice = resolveUnitPrice(headrailProduct, headrailRow, 'Headrail', ['cost_price', 'unit_price', 'price', 'rate'], true)
  const bracketUnitPrice = toNumber(bracketProduct?.cost_price, NaN)
  if (!Number.isFinite(bracketUnitPrice) || bracketUnitPrice <= 0) {
    if (hangerSku) {
      throw new Error(`Hanger price missing in Supabase for SKU ${hangerSku}`)
    }
    throw new Error(`Hanger price missing in Supabase for selected hanger width ${input.hangerWidthMm}mm`)
  }
  const rivetUnitPrice = resolveUnitPrice(fittingProduct, fittingRow, 'Rivets', ['cost_price', 'unit_price', 'price', 'rate'], true)
  const rivetsPerStrip = toNumber(
    getValueFromRow(fittingRow, [
      'rivets_per_strip',
      'rivet_qty_per_strip',
      'fittings_per_strip',
      'qty_per_strip',
      'quantity_per_strip',
    ]),
    NaN,
  )
  const packagingUnitPrice = resolveUnitPrice(packagingProduct, packagingRow, 'Packaging', ['cost_price', 'unit_price', 'price', 'rate'], true)
  return {
    stripProductId: stripProduct?.id ?? null,
    headrailProductId: headrailProduct?.id ?? null,
    bracketProductId: bracketProduct?.id ?? null,
    fittingProductId: fittingProduct?.id ?? null,
    labourProductId: labourProduct?.id ?? null,
    packagingProductId: packagingProduct?.id ?? null,
    stripUnitPrice,
    headrailUnitPrice,
    bracketUnitPrice,
    rivetUnitPrice,
    rivetsPerStrip: Number.isFinite(rivetsPerStrip) ? rivetsPerStrip : null,
    packagingUnitPrice,
  }
}

export async function generateQuote(
  supabase: SupabaseClient,
  input: PVCCalculatorInput,
  options?: { persistQuote?: boolean; createdBy?: string | null },
): Promise<PVCCalculationResponse> {
  const settings = await getCalculatorSettings(supabase)
  const prices = await fetchProductPrices(supabase, input)
  const calculation = calculatePVCQuote(input, settings, prices)
  const { lineItems } = calculation
  const subtotal = calculation.totals.subtotal
  const finalPrice = calculation.totals.finalPrice

  let quoteId: string | undefined

  if (options?.persistQuote) {
    const quotePayload: Record<string, unknown> = {
      opening_width_mm: input.openingWidthMm,
      opening_height_mm: input.openingHeightMm,
      strip_type: input.stripType,
      strip_width_mm: input.stripWidth,
      hanger_width_mm: input.hangerWidthMm,
      strips_per_hanger: calculation.breakdown.stripsPerHanger,
      thickness_mm: input.stripThicknessMm,
      overlap_percent: input.overlapMm,
      headrail_type: input.headrailType,
      installation_type: input.installationType,
      calculator_version: PVC_CALCULATOR_VERSION,
      subtotal,
      final_price: finalPrice,
    }

    if (options.createdBy) {
      quotePayload.created_by = options.createdBy
    }

    const { data: quote, error: quoteError } = await supabase
      .from('pvc_quotes')
      .insert(quotePayload)
      .select('id')
      .single()

    if (quoteError) {
      throw quoteError
    }

    quoteId = quote.id

    const quoteItemsPayload = lineItems
      .filter(item => item.quantity > 0)
      .map(item => ({
        quote_id: quoteId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
      }))

    if (quoteItemsPayload.length > 0) {
      const { error: quoteItemsError } = await supabase
        .from('pvc_quote_items')
        .insert(quoteItemsPayload)

      if (quoteItemsError) {
        throw quoteItemsError
      }
    }
  }

  return {
    ...calculation,
    quoteId,
  }
}
