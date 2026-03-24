import { NextResponse } from 'next/server'
import { requireInventoryAccess } from '@/lib/auth/inventoryAccess'
import { InventoryService } from '@/lib/services/inventory.service'

export const runtime = 'nodejs'

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
