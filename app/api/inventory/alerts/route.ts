import { NextResponse } from 'next/server'
import { requireInventoryAccess } from '@/lib/auth/inventoryAccess'
import { InventoryService } from '@/lib/services/inventory.service'



export async function GET() {
  try {
    const access = await requireInventoryAccess()
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const alerts = await InventoryService.getLowStockAlerts()
    return NextResponse.json({ alerts })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load alerts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
