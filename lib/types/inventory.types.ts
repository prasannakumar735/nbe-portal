export type InventoryAccessRole = 'admin' | 'manager' | 'employee' | string

export type InventoryStatus = 'ok' | 'low' | 'insufficient'

export interface ComponentRow {
  id: string
  sku: string
  name: string
  unit: string
  stock_quantity: number
  min_stock: number
  is_active: boolean
}

export interface BomRow {
  id: string
  product_id: string
  product_name: string | null
  component_id: string
  quantity_per_unit: number
  wastage_percentage: number
  is_active: boolean
  component?: Pick<ComponentRow, 'id' | 'sku' | 'name' | 'unit' | 'stock_quantity' | 'min_stock'>
}

export interface InventoryPreviewItem {
  component_id: string
  component_name: string
  sku: string
  required_qty: number
  available_qty: number
  min_stock: number
  remaining_qty: number
  status: InventoryStatus
}

export interface InventoryMovementRow {
  id: string
  component_id: string
  movement_type: 'in' | 'out' | 'adjustment' | 'reserved' | 'release'
  quantity: number
  reference_type: string | null
  reference_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
  component?: Pick<ComponentRow, 'id' | 'sku' | 'name' | 'unit'>
}

export interface ProcessOrderResult {
  order_reference: string
  items: Array<{
    component_id: string
    component_name: string
    required_qty: number
    available_qty: number
    remaining_qty: number
    status: InventoryStatus
  }>
}
