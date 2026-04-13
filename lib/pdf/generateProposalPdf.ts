import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ProposalDoor, QuoteData } from '@/lib/types/quote.types'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'

function currency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}` : value
}

function toLegacyStripProfileLabel(door: ProposalDoor): string {
  if (door.strip_type_label && door.strip_type_label.trim().length > 0) {
    return door.strip_type_label.trim()
  }

  if (door.strip_type.includes('ribbed')) {
    return 'Coolroom Ambient Ribbed profile'
  }

  if (door.strip_type === 'polar') {
    return 'Coolroom Polar Smooth profile'
  }

  return `${capitalize(door.strip_type)} profile`
}

function deriveDoors(quoteData: QuoteData): ProposalDoor[] {
  if (quoteData.doors && quoteData.doors.length > 0) {
    return quoteData.doors
  }

  return [
    {
      width_mm: quoteData.input.width_mm,
      height_mm: quoteData.input.height_mm,
      overlap_mm: quoteData.input.overlap_mm,
      strip_width_mm: quoteData.input.strip_width_mm,
      thickness_mm: quoteData.input.thickness_mm,
      strip_type: quoteData.input.strip_type,
      headrail_type: quoteData.input.headrail_type,
      number_of_strips: quoteData.calculated.strip_count,
      final_door_price: quoteData.calculated.final_quote_price,
    },
  ]
}

export async function generateProposalPdf(quoteData: QuoteData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const roboto = await embedRobotoForPdfLib(pdfDoc)
  const boldFont = roboto?.bold ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
  const regularFont = roboto?.regular ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))

  const left = 40
  const right = 555
  let y = 800

  try {
    const logoPath = path.join(process.cwd(), 'public', 'Logo_black.png')
    const logoBytes = await readFile(logoPath)
    const logoImage = await pdfDoc.embedPng(logoBytes)
    const logoDims = logoImage.scale(0.2)

    page.drawImage(logoImage, {
      x: left,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    })
  } catch {
    page.drawText('NBE Australia', { x: left, y: y - 8, size: 16, font: boldFont })
  }

  page.drawText('NBE Australia', { x: 360, y: y - 6, size: 11, font: boldFont })
  page.drawText('Fact 22A Humeside Dr', { x: 360, y: y - 20, size: 10, font: regularFont })
  page.drawText('Campbellfield VIC 3061', { x: 360, y: y - 34, size: 10, font: regularFont })
  page.drawText('Ph: 03 9357 5858', { x: 360, y: y - 48, size: 10, font: regularFont })

  y -= 90

  page.drawText('PVC Strip Door Proposal', {
    x: left,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.4),
  })

  y -= 32

  const details = quoteData.customerDetails || {}
  const dateText = details.date || new Date().toLocaleDateString('en-AU')

  const customerRows = [
    ['Customer:', details.customer || ''],
    ['Attn:', details.attn || ''],
    ['Address:', details.address || ''],
    ['Date:', dateText],
    ['Ref No:', details.refNo || ''],
  ]

  customerRows.forEach(([label, value]) => {
    page.drawText(label, { x: left, y, size: 10, font: boldFont })
    page.drawText(value, { x: left + 72, y, size: 10, font: regularFont })
    y -= 14
  })

  y -= 10

  const descriptionColX = left
  const unitColX = 430
  const totalColX = 510

  page.drawRectangle({ x: left, y: y - 3, width: right - left, height: 18, color: rgb(0.94, 0.95, 0.99) })
  page.drawText('Description Of The Item', { x: descriptionColX + 4, y: y + 1, size: 10, font: boldFont })
  page.drawText('Unit Cost', { x: unitColX, y: y + 1, size: 10, font: boldFont })
  page.drawText('Total Cost', { x: totalColX, y: y + 1, size: 10, font: boldFont })

  y -= 24

  const doors = deriveDoors(quoteData)

  doors.forEach(door => {
    const headrailLabel = capitalize(door.headrail_type)
    const profileLabel = toLegacyStripProfileLabel(door)

    const lines = [
      `1 PVC Strip Door ${door.height_mm} mm Height x ${door.width_mm} mm Width`,
      `Headrail ${headrailLabel} ${door.overlap_mm} mm overlap`,
      `PVC Strips ${door.strip_width_mm} mm Width x ${door.thickness_mm} mm Thick`,
      `Strip Type ${profileLabel}`,
      `${door.number_of_strips}`,
    ]

    lines.forEach((line, index) => {
      page.drawText(line, { x: descriptionColX + 4, y, size: 10, font: regularFont })

      if (index === 0) {
        const price = currency(door.final_door_price)
        page.drawText(price, { x: unitColX, y, size: 10, font: regularFont })
        page.drawText(price, { x: totalColX, y, size: 10, font: regularFont })
      }

      y -= 13
    })

    y -= 8
  })

  const freightCost = Number.isFinite(quoteData.freightCost) ? Number(quoteData.freightCost) : undefined
  const installationCost = Number.isFinite(quoteData.installationCost) ? Number(quoteData.installationCost) : undefined

  if (freightCost !== undefined) {
    page.drawText('1 Freight', { x: descriptionColX + 4, y, size: 10, font: regularFont })
    page.drawText(currency(freightCost), { x: totalColX, y, size: 10, font: regularFont })
    y -= 14
  }

  if (installationCost !== undefined) {
    page.drawText('1 Installation Of PVC Strip Door/s', { x: descriptionColX + 4, y, size: 10, font: regularFont })
    page.drawText(currency(installationCost), { x: totalColX, y, size: 10, font: regularFont })
    y -= 14
  }

  y -= 8
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) })
  y -= 18

  const doorsTotal = round2(doors.reduce((sum, door) => sum + door.final_door_price, 0))
  const subtotalCost = round2(doorsTotal + (freightCost || 0) + (installationCost || 0))
  const gst = round2(subtotalCost * 0.1)
  const totalCost = round2(subtotalCost + gst)

  page.drawText('Subtotal Cost', { x: unitColX - 40, y, size: 11, font: boldFont })
  page.drawText(currency(subtotalCost), { x: totalColX, y, size: 11, font: regularFont })
  y -= 16

  page.drawText('GST 10%', { x: unitColX - 40, y, size: 11, font: boldFont })
  page.drawText(currency(gst), { x: totalColX, y, size: 11, font: regularFont })
  y -= 18

  page.drawRectangle({ x: unitColX - 54, y: y - 4, width: 160, height: 22, color: rgb(0.9, 0.95, 1) })
  page.drawText('Total Cost', { x: unitColX - 40, y: y + 2, size: 11, font: boldFont, color: rgb(0.1, 0.2, 0.5) })
  page.drawText(currency(totalCost), { x: totalColX, y: y + 2, size: 11, font: boldFont, color: rgb(0.1, 0.2, 0.5) })

  y -= 72

  page.drawText('Acc Name NBE AUSTRALIA', { x: left, y, size: 10, font: regularFont })
  y -= 13
  page.drawText('BSB 013 525', { x: left, y, size: 10, font: regularFont })
  y -= 13
  page.drawText('Acc 3473 93755', { x: left, y, size: 10, font: regularFont })
  y -= 13
  page.drawText('ABN 17 007 048 008 GST Registered', { x: left, y, size: 10, font: regularFont })
  y -= 18
  page.drawText('accounts@nbeaustralia.com.au', { x: left, y, size: 10, font: regularFont })
  y -= 30

  page.drawText('Signature ______________________________', { x: left, y, size: 10, font: regularFont })
  y -= 24
  page.drawText('Date ______________________________', { x: left, y, size: 10, font: regularFont })

  return pdfDoc.save()
}
