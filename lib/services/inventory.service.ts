import { createClient } from '@supabase/supabase-js'
import type {
  BomRow,
  ComponentRow,
  InventoryMovementRow,
  InventoryPreviewItem,
  ProcessOrderResult,
} from '@/lib/types/inventory.types'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase service role configuration.')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function toNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeComponentRelation(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown>) ?? null
  }
  return value as Record<string, unknown>
}

export class InventoryService {
  static async getComponents(): Promise<ComponentRow[]> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('components')
      .select('id, sku, name, unit, stock_quantity, min_stock, is_active')
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: String(row.id),
      sku: String(row.sku),
      name: String(row.name),
      unit: String(row.unit ?? 'pcs'),
      stock_quantity: toNumber(row.stock_quantity),
      min_stock: toNumber(row.min_stock),
      is_active: Boolean(row.is_active),
    }))
  }

  static async getProducts(): Promise<Array<{ product_id: string; product_name: string }>> {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('bill_of_materials')
      .select('product_id, product_name')
      .eq('is_active', true)

    if (error) throw new Error(error.message)

    const deduped = new Map<string, string>()
    for (const row of data ?? []) {
      const productId = String(row.product_id ?? '').trim()
      if (!productId) continue
      const productName = String(row.product_name ?? '').trim() || productId
      if (!deduped.has(productId)) deduped.set(productId, productName)
    }

    return Array.from(deduped.entries())
      .map(([product_id, product_name]) => ({ product_id, product_name }))
      .sort((a, b) => a.product_name.localeCompare(b.product_name))
  }

  static async getBom(productId?: string): Promise<BomRow[]> {
    const supabase = createServiceClient()
    let query = supabase
      .from('bill_of_materials')
      .select(`
        id,
        product_id,
        product_name,
        component_id,
        quantity_per_unit,
        wastage_percentage,
        is_active,
        component:components (id, sku, name, unit, stock_quantity, min_stock)
      `)
      .order('product_id', { ascending: true })

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: String(row.id),
      product_id: String(row.product_id),
      product_name: row.product_name ? String(row.product_name) : null,
      component_id: String(row.component_id),
      quantity_per_unit: toNumber(row.quantity_per_unit),
      wastage_percentage: toNumber(row.wastage_percentage),
      is_active: Boolean(row.is_active),
      component: normalizeComponentRelation(row.component)
        ? {
            id: String(normalizeComponentRelation(row.component)?.id ?? ''),
            sku: String(normalizeComponentRelation(row.component)?.sku ?? ''),
            name: String(normalizeComponentRelation(row.component)?.name ?? ''),
            unit: String(normalizeComponentRelation(row.component)?.unit ?? 'pcs'),
            stock_quantity: toNumber(normalizeComponentRelation(row.component)?.stock_quantity),
            min_stock: toNumber(normalizeComponentRelation(row.component)?.min_stock),
          }
        : undefined,
    }))
  }

  static async getMovements(limit = 50): Promise<InventoryMovementRow[]> {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('inventory_movements')
      .select(`
        id,
        component_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        note,
        created_by,
        created_at,
        component:components (id, sku, name, unit)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: String(row.id),
      component_id: String(row.component_id),
      movement_type: row.movement_type as InventoryMovementRow['movement_type'],
      quantity: toNumber(row.quantity),
      reference_type: row.reference_type ? String(row.reference_type) : null,
      reference_id: row.reference_id ? String(row.reference_id) : null,
      note: row.note ? String(row.note) : null,
      created_by: row.created_by ? String(row.created_by) : null,
      created_at: String(row.created_at),
      component: normalizeComponentRelation(row.component)
        ? {
            id: String(normalizeComponentRelation(row.component)?.id ?? ''),
            sku: String(normalizeComponentRelation(row.component)?.sku ?? ''),
            name: String(normalizeComponentRelation(row.component)?.name ?? ''),
            unit: String(normalizeComponentRelation(row.component)?.unit ?? 'pcs'),
          }
        : undefined,
    }))
  }

  static async getLowStockAlerts(): Promise<ComponentRow[]> {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('components')
      .select('id, sku, name, unit, stock_quantity, min_stock, is_active')
      .eq('is_active', true)
      .filter('stock_quantity', 'lte', 'min_stock')
      .order('stock_quantity', { ascending: true })

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => ({
      id: String(row.id),
      sku: String(row.sku),
      name: String(row.name),
      unit: String(row.unit ?? 'pcs'),
      stock_quantity: toNumber(row.stock_quantity),
      min_stock: toNumber(row.min_stock),
      is_active: Boolean(row.is_active),
    }))
  }

  static async previewInventory(productId: string, quantity: number): Promise<InventoryPreviewItem[]> {
    const supabase = createServiceClient()

    const { data: bomRows, error: bomError } = await supabase
      .from('bill_of_materials')
      .select(`
        component_id,
        quantity_per_unit,
        wastage_percentage,
        component:components (id, sku, name, stock_quantity, min_stock, is_active)
      `)
      .eq('product_id', productId)
      .eq('is_active', true)

    if (bomError) throw new Error(bomError.message)
    if (!bomRows?.length) throw new Error('No active BOM found for selected product.')

    const preview = bomRows
      .map((row) => {
        const component = normalizeComponentRelation(row.component) as {
          id?: string
          sku?: string
          name?: string
          stock_quantity?: unknown
          min_stock?: unknown
          is_active?: boolean
        } | null

        if (!component || !component.is_active) return null

        const requiredQty = Number(
          (toNumber(row.quantity_per_unit) * quantity * (1 + toNumber(row.wastage_percentage) / 100)).toFixed(3)
        )
        const availableQty = toNumber(component.stock_quantity)
        const minStock = toNumber(component.min_stock)
        const remainingQty = Number((availableQty - requiredQty).toFixed(3))

        let status: InventoryPreviewItem['status'] = 'ok'
        if (requiredQty > availableQty) status = 'insufficient'
        else if (remainingQty <= minStock) status = 'low'

        return {
          component_id: String(component.id ?? ''),
          component_name: String(component.name ?? ''),
          sku: String(component.sku ?? ''),
          required_qty: requiredQty,
          available_qty: availableQty,
          min_stock: minStock,
          remaining_qty: remainingQty,
          status,
        }
      })
      .filter((row): row is InventoryPreviewItem => row !== null)
      .sort((a, b) => a.component_name.localeCompare(b.component_name))

    return preview
  }

  static async createComponent(input: {
    sku: string
    name: string
    unit?: string
    stock_quantity?: number
    min_stock?: number
  }): Promise<ComponentRow> {
    const supabase = createServiceClient()
    const payload = {
      sku: input.sku.trim(),
      name: input.name.trim(),
      unit: (input.unit ?? 'pcs').trim(),
      stock_quantity: input.stock_quantity ?? 0,
      min_stock: input.min_stock ?? 0,
      is_active: true,
    }

    const { data, error } = await supabase
      .from('components')
      .insert(payload)
      .select('id, sku, name, unit, stock_quantity, min_stock, is_active')
      .single()

    if (error) throw new Error(error.message)

    return {
      id: String(data.id),
      sku: String(data.sku),
      name: String(data.name),
      unit: String(data.unit ?? 'pcs'),
      stock_quantity: toNumber(data.stock_quantity),
      min_stock: toNumber(data.min_stock),
      is_active: Boolean(data.is_active),
    }
  }

  static async addBomItem(input: {
    product_id: string
    product_name?: string
    component_id: string
    quantity_per_unit: number
    wastage_percentage?: number
  }): Promise<BomRow> {
    const supabase = createServiceClient()

    const payload = {
      product_id: input.product_id.trim(),
      product_name: input.product_name?.trim() || null,
      component_id: input.component_id,
      quantity_per_unit: input.quantity_per_unit,
      wastage_percentage: input.wastage_percentage ?? 0,
      is_active: true,
    }

    const { data, error } = await supabase
      .from('bill_of_materials')
      .upsert(payload, { onConflict: 'product_id,component_id' })
      .select('id, product_id, product_name, component_id, quantity_per_unit, wastage_percentage, is_active')
      .single()

    if (error) throw new Error(error.message)

    return {
      id: String(data.id),
      product_id: String(data.product_id),
      product_name: data.product_name ? String(data.product_name) : null,
      component_id: String(data.component_id),
      quantity_per_unit: toNumber(data.quantity_per_unit),
      wastage_percentage: toNumber(data.wastage_percentage),
      is_active: Boolean(data.is_active),
    }
  }

  static async processOrder(input: {
    product_id: string
    quantity: number
    order_reference: string
    user_id: string
  }): Promise<ProcessOrderResult> {
    const supabase = createServiceClient()

    const { data, error } = await supabase.rpc('process_inventory_order', {
      p_product_id: input.product_id,
      p_quantity: input.quantity,
      p_reference_id: input.order_reference,
      p_created_by: input.user_id,
    })

    if (error) throw new Error(error.message)

    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      component_id: String(row.component_id),
      component_name: String(row.component_name),
      required_qty: toNumber(row.required_qty),
      available_qty: toNumber(row.available_qty),
      remaining_qty: toNumber(row.remaining_qty),
      status: String(row.status) as ProcessOrderResult['items'][number]['status'],
    }))

    return {
      order_reference: input.order_reference,
      items,
    }
  }
}
