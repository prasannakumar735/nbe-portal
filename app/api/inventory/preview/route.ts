import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInventoryAccess } from '@/lib/auth/inventoryAccess'
import { InventoryService } from '@/lib/services/inventory.service'

const previewSchema = z.object({
  product_id: z.string().trim().min(1),
  quantity: z.number().positive(),
})

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const raw = await request.json().catch(() => null)
    const parsed = previewSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const preview = await InventoryService.previewInventory(parsed.data.product_id, parsed.data.quantity)

    return NextResponse.json({
      product_id: parsed.data.product_id,
      quantity: parsed.data.quantity,
      components: preview,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to preview inventory requirements'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
