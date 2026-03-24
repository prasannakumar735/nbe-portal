import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInventoryAccess } from '@/lib/auth/inventoryAccess'
import { InventoryService } from '@/lib/services/inventory.service'
import { sendInventoryLowStockAlertEmail } from '@/lib/email/sendInventoryLowStockAlert'

const createOrderSchema = z.object({
  product_id: z.string().trim().min(1),
  quantity: z.number().positive(),
  order_reference: z.string().trim().min(1).optional(),
})

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const raw = await request.json().catch(() => null)
    const parsed = createOrderSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const orderReference = parsed.data.order_reference || `ORD-${Date.now()}`

    const result = await InventoryService.processOrder({
      product_id: parsed.data.product_id,
      quantity: parsed.data.quantity,
      order_reference: orderReference,
      user_id: access.user.id,
    })

    const insufficientItems = result.items.filter((item) => item.status === 'insufficient')
    if (insufficientItems.length > 0) {
      return NextResponse.json(
        {
          error: 'Insufficient stock for one or more components.',
          order_reference: orderReference,
          components: result.items,
        },
        { status: 409 }
      )
    }

    const lowStockItems = result.items.filter((item) => item.status === 'low')
    if (lowStockItems.length > 0) {
      try {
        const currentAlerts = await InventoryService.getLowStockAlerts()
        const lowStockByComponentId = new Map(lowStockItems.map((item) => [item.component_id, item]))
        const emailItems = currentAlerts
          .filter((component) => lowStockByComponentId.has(component.id))
          .map((component) => ({
            componentName: component.name,
            sku: component.sku,
            stockQuantity: component.stock_quantity,
            minStock: component.min_stock,
          }))

        if (emailItems.length > 0) {
          await sendInventoryLowStockAlertEmail(emailItems)
        }
      } catch (alertError) {
        console.error('[Inventory] Low stock alert email failed:', alertError)
      }
    }

    return NextResponse.json({
      success: true,
      order_reference: orderReference,
      components: result.items,
      low_stock_alerts_triggered: lowStockItems.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process order'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
