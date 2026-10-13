import { sendMailViaGraph } from '@/lib/graph/sendMail'

type LowStockItem = {
  componentName: string
  sku: string
  stockQuantity: number
  minStock: number
}

export async function sendInventoryLowStockAlertEmail(items: LowStockItem[]): Promise<void> {
  if (!items.length) return

  const to = process.env.INVENTORY_ALERT_EMAIL || process.env.MAINTENANCE_ADMIN_EMAIL
  if (!to) throw new Error('Missing INVENTORY_ALERT_EMAIL or MAINTENANCE_ADMIN_EMAIL env var')

  const lines = items.map((item) => (
    `- ${item.componentName} (${item.sku}): ${item.stockQuantity} <= min ${item.minStock}`
  ))

  await sendMailViaGraph({
    to,
    subject: 'NBE Inventory Alert - Low Stock Detected',
    bodyText: [
      'Low stock components were detected during inventory processing.',
      '',
      ...lines,
    ].join('\n'),
  })
}
