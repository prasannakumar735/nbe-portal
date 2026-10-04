import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInventoryAccess } from '@/lib/auth/inventoryAccess'
import { InventoryService } from '@/lib/services/inventory.service'

const movementSchema = z.object({
  component_id: z.string().uuid(),
  movement_type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().positive(),
  note: z.string().trim().max(500).optional(),
})



export async function GET(request: Request) {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { searchParams } = new URL(request.url)
    const limitRaw = Number(searchParams.get('limit') ?? '50')
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50

    const movements = await InventoryService.getMovements(limit)
    return NextResponse.json({ movements })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch inventory movements'
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
    const parsed = movementSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const movement = await InventoryService.recordMovement({
      ...parsed.data,
      user_id: access.user.id,
    })
    return NextResponse.json({ movement }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record movement'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
