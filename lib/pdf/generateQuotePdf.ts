import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { QuoteData } from '@/lib/types/quote.types'

function currency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: Date): string {
  return value.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function generateQuotePdf(quoteData: QuoteData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  let y = 800
  const left = 40

  try {
    const logoPath = path.join(process.cwd(), 'public', 'Logo_black.png')
    const logoBytes = await readFile(logoPath)
    const logoImage = await pdfDoc.embedPng(logoBytes)
    const logoDims = logoImage.scale(0.22)
    page.drawImage(logoImage, {
      x: left,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    })
  } catch {
    page.drawText('NBE Australia', {
      x: left,
      y: y - 12,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    })
  }

  page.drawText('NBE Australia', { x: 380, y: y - 8, size: 12, font: boldFont })
  page.drawText('7 Kibble Place, Menai NSW 2234', { x: 380, y: y - 24, size: 10, font: regularFont })
  page.drawText('Phone: +61 2 0000 0000', { x: 380, y: y - 38, size: 10, font: regularFont })

  y -= 90

  page.drawText('PVC Strip Door Quote', {
    x: left,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0.12, 0.12, 0.45),
  })
  page.drawText(`Generated: ${formatDate(new Date())}`, {
    x: left,
    y: y - 18,
    size: 10,
    font: regularFont,
    color: rgb(0.35, 0.35, 0.35),
  })

  y -= 50

  page.drawText('Customer Details', { x: left, y, size: 13, font: boldFont })
  y -= 18

  const customerRows = [
    ['Width (mm)', String(quoteData.input.width_mm)],
    ['Height (mm)', String(quoteData.input.height_mm)],
    ['Strip Type', quoteData.input.strip_type],
    ['Strip Width (mm)', String(quoteData.input.strip_width_mm)],
    ['Thickness (mm)', String(quoteData.input.thickness_mm)],
    ['Overlap (mm)', String(quoteData.input.overlap_mm)],
    ['Headrail Type', quoteData.input.headrail_type],
    ['Install Type', quoteData.input.install_type],
  ]

  customerRows.forEach(([label, value]) => {
    page.drawText(label, { x: left, y, size: 10, font: boldFont })
    page.drawText(value, { x: left + 145, y, size: 10, font: regularFont })
    y -= 14
  })

  y -= 8
  page.drawText('Technician Information', { x: left, y, size: 13, font: boldFont })
  y -= 18

  const techRows = [
    ['Number of Strips', String(quoteData.calculated.strip_count)],
    ['Strip Length (mm)', quoteData.calculated.strip_length_mm.toFixed(2)],
    ['Total Strip Material (meters)', quoteData.calculated.strip_meters.toFixed(2)],
  ]

  techRows.forEach(([label, value]) => {
    page.drawText(label, { x: left, y, size: 10, font: boldFont })
    page.drawText(value, { x: left + 180, y, size: 10, font: regularFont })
    y -= 14
  })

  y -= 12

  page.drawText('Material & Cost Breakdown', { x: left, y, size: 13, font: boldFont })
  y -= 18

  const tableX = left
  const colX = [tableX, tableX + 230, tableX + 320, tableX + 430]
  page.drawRectangle({ x: tableX, y: y - 4, width: 510, height: 18, color: rgb(0.94, 0.95, 0.99) })
  page.drawText('Item', { x: colX[0] + 4, y, size: 10, font: boldFont })
  page.drawText('Quantity', { x: colX[1] + 4, y, size: 10, font: boldFont })
  page.drawText('Unit Price', { x: colX[2] + 4, y, size: 10, font: boldFont })
  page.drawText('Total', { x: colX[3] + 4, y, size: 10, font: boldFont })

  y -= 20

  const rows = quoteData.result.lineItems.map(item => [
    item.material,
    `${item.quantity.toFixed(2)} ${item.unit}`,
    currency(item.unitPrice),
    currency(item.lineTotal),
  ])

  rows.forEach(row => {
    page.drawText(row[0], { x: colX[0] + 4, y, size: 10, font: regularFont })
    page.drawText(row[1], { x: colX[1] + 4, y, size: 10, font: regularFont })
    page.drawText(row[2], { x: colX[2] + 4, y, size: 10, font: regularFont })
    page.drawText(row[3], { x: colX[3] + 4, y, size: 10, font: regularFont })
    y -= 15
  })

  y -= 8
  page.drawLine({ start: { x: tableX, y }, end: { x: tableX + 510, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) })
  y -= 18

  page.drawText('Subtotal', { x: 380, y, size: 11, font: boldFont })
  page.drawText(currency(quoteData.calculated.subtotal), { x: 460, y, size: 11, font: regularFont })
  y -= 16

  page.drawText('Markup %', { x: 380, y, size: 11, font: boldFont })
  page.drawText(`${quoteData.calculated.markup_percent}%`, { x: 460, y, size: 11, font: regularFont })
  y -= 24

  page.drawRectangle({ x: 360, y: y - 6, width: 170, height: 26, color: rgb(0.9, 0.95, 1) })
  page.drawText('Final Quote Price', { x: 370, y: y + 2, size: 12, font: boldFont, color: rgb(0.1, 0.2, 0.5) })
  page.drawText(currency(quoteData.calculated.final_quote_price), {
    x: 470,
    y: y + 2,
    size: 12,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.5),
  })

  page.drawText('Generated by NBE Portal', {
    x: left,
    y: 30,
    size: 9,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  })

  return pdfDoc.save()
}
