import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInventoryAccess } from '@/lib/auth/inventoryAccess'
import { InventoryService } from '@/lib/services/inventory.service'

const bomSchema = z.object({
  product_id: z.string().trim().min(1),
  product_name: z.string().trim().optional(),
  component_id: z.string().uuid(),
  quantity_per_unit: z.number().positive(),
  wastage_percentage: z.number().min(0).optional(),
})

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')?.trim() || undefined
    const bom = await InventoryService.getBom(productId)

    return NextResponse.json({ bom })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch BOM'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const raw = await request.json().catch(() => null)
    const parsed = bomSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const bomItem = await InventoryService.addBomItem(parsed.data)
    return NextResponse.json({ bomItem }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upsert BOM'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
