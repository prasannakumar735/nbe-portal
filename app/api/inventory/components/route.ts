import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInventoryAccess } from '@/lib/auth/inventoryAccess'
import { InventoryService } from '@/lib/services/inventory.service'

const createComponentSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1).optional(),
  stock_quantity: z.number().min(0).optional(),
  min_stock: z.number().min(0).optional(),
})

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const components = await InventoryService.getComponents()
    return NextResponse.json({ components })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch components'
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
    const parsed = createComponentSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const component = await InventoryService.createComponent(parsed.data)
    return NextResponse.json({ component }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create component'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
