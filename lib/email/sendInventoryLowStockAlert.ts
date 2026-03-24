import nodemailer from 'nodemailer'

type LowStockItem = {
  componentName: string
  sku: string
  stockQuantity: number
  minStock: number
}

export async function sendInventoryLowStockAlertEmail(items: LowStockItem[]): Promise<void> {
  if (!items.length) return

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user
  const to = process.env.INVENTORY_ALERT_EMAIL || process.env.MAINTENANCE_ADMIN_EMAIL || 'service@nbeaustralia.com.au'

  if (!host || !user || !pass || !from) {
    throw new Error('Missing SMTP configuration for inventory low stock alerts.')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const lines = items.map((item) => (
    `- ${item.componentName} (${item.sku}): ${item.stockQuantity} <= min ${item.minStock}`
  ))

  await transporter.sendMail({
    from,
    to,
    subject: 'NBE Inventory Alert - Low Stock Detected',
    text: [
      'Low stock components were detected during inventory processing.',
      '',
      ...lines,
    ].join('\n'),
  })
}
