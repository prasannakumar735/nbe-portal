import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import type { ProposalDoor } from '@/lib/types/quote.types'
import {
  formatProposalHeadrailLabel,
  formatProposalStripTypeLine,
} from '@/lib/calculators/pvcQuoteLabels'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'
import type { QuoteData } from '@/lib/types/quote.types'

export type PvcJobCardPdfInput = {
  quoteData: QuoteData
  headrailLengthMm: number | null
  supplyScope: 'strips_only' | 'whole_door'
  assignedToName: string
  poReference?: string | null
  approvalMessage?: string | null
}

function deriveDoors(quoteData: QuoteData): ProposalDoor[] {
  if (quoteData.doors && quoteData.doors.length > 0) {
    return quoteData.doors
  }
  const quantity = Math.min(99, Math.max(1, Math.trunc(quoteData.input.door_quantity ?? 1) || 1))
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
      quantity,
    },
  ]
}

function doorSupplyScope(door: ProposalDoor): 'strips_only' | 'whole_door' {
  const ht = (door.headrail_type ?? '').toLowerCase()
  return ht === 'none' || ht === 'strips_only' ? 'strips_only' : 'whole_door'
}

function drawHLine(page: PDFPage, x: number, y: number, width: number, thickness = 0.5) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness,
    color: rgb(0.8, 0.8, 0.8),
  })
}

function drawRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor = rgb(0.95, 0.95, 0.97),
) {
  page.drawRectangle({ x, y, width: w, height: h, color: fillColor })
}

export async function generatePvcJobCardPdf(input: PvcJobCardPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const { width: pageWidth } = page.getSize()

  const roboto = await embedRobotoForPdfLib(pdfDoc)
  const boldFont: PDFFont = roboto?.bold ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
  const regularFont: PDFFont = roboto?.regular ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))

  const marginL = 40
  const marginR = 40
  const contentWidth = pageWidth - marginL - marginR
  let y = 800

  // ── Header: Logo + company info ──────────────────────────────────────────
  const logoHeight = 44
  try {
    const logoPath = path.join(process.cwd(), 'public', 'NBE_LOGO_BK_PL.png')
    const logoBytes = await readFile(logoPath)
    const logoImage = await pdfDoc.embedPng(logoBytes)
    const { width: nw, height: nh } = logoImage
    const logoWidth = (nw / nh) * logoHeight
    page.drawImage(logoImage, { x: marginL, y: y - logoHeight, width: logoWidth, height: logoHeight })
  } catch {
    page.drawText('NBE Australia', { x: marginL, y: y - 14, size: 13, font: boldFont })
  }

  const companyX = pageWidth - marginR - 140
  page.drawText('NBE Australia', { x: companyX, y: y - 8, size: 10, font: boldFont, color: rgb(0.1, 0.1, 0.1) })
  page.drawText('22A Humeside Drive', { x: companyX, y: y - 20, size: 9, font: regularFont, color: rgb(0.35, 0.35, 0.35) })
  page.drawText('Campbellfield VIC 3061', { x: companyX, y: y - 31, size: 9, font: regularFont, color: rgb(0.35, 0.35, 0.35) })
  page.drawText('Ph: 03 9357 5858', { x: companyX, y: y - 42, size: 9, font: regularFont, color: rgb(0.35, 0.35, 0.35) })

  y -= logoHeight + 12

  // ── Title bar ────────────────────────────────────────────────────────────
  drawRect(page, marginL, y - 24, contentWidth, 26, rgb(0.1, 0.1, 0.38))
  page.drawText('PVC Strip Curtain — Job Card', {
    x: marginL + 10,
    y: y - 18,
    size: 13,
    font: boldFont,
    color: rgb(1, 1, 1),
  })
  y -= 36

  // ── Customer section ─────────────────────────────────────────────────────
  const details = input.quoteData.customerDetails || {}

  drawRect(page, marginL, y - 72, contentWidth, 74, rgb(0.97, 0.97, 0.99))
  page.drawLine({ start: { x: marginL, y: y }, end: { x: marginL + contentWidth, y }, thickness: 0.5, color: rgb(0.78, 0.78, 0.85) })
  page.drawLine({ start: { x: marginL, y: y - 72 }, end: { x: marginL + contentWidth, y: y - 72 }, thickness: 0.5, color: rgb(0.78, 0.78, 0.85) })

  const col1x = marginL + 8
  const col2x = marginL + 90
  const col3x = marginL + contentWidth / 2 + 8
  const col4x = marginL + contentWidth / 2 + 80

  const custRows: [string, string, string, string][] = [
    ['Customer:', details.customer || '—', 'Date:', details.date || new Date().toLocaleDateString('en-AU')],
    ['Attn:', details.attn || '—', 'Ref No:', details.refNo || '—'],
    ['Address:', (details.address || '—').slice(0, 38), 'PO / Ref:', input.poReference?.trim() || '—'],
    ['Assigned:', input.assignedToName || '—', '', ''],
  ]

  let rowY = y - 14
  custRows.forEach(([l1, v1, l2, v2]) => {
    page.drawText(l1, { x: col1x, y: rowY, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
    page.drawText(v1, { x: col2x, y: rowY, size: 9, font: regularFont, color: rgb(0.1, 0.1, 0.1) })
    if (l2) {
      page.drawText(l2, { x: col3x, y: rowY, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(v2, { x: col4x, y: rowY, size: 9, font: regularFont, color: rgb(0.1, 0.1, 0.1) })
    }
    rowY -= 15
  })

  y -= 82

  // ── Notes ────────────────────────────────────────────────────────────────
  if (input.approvalMessage?.trim()) {
    const note = input.approvalMessage.trim().slice(0, 220)
    page.drawText('Notes:', { x: marginL, y, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
    page.drawText(note, { x: marginL + 48, y, size: 9, font: regularFont, color: rgb(0.1, 0.1, 0.1) })
    y -= 16
  }

  y -= 6
  drawHLine(page, marginL, y, contentWidth)
  y -= 14

  // ── Door specifications ──────────────────────────────────────────────────
  page.drawText('Door Specifications', {
    x: marginL,
    y,
    size: 11,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.38),
  })
  y -= 16

  const doors = deriveDoors(input.quoteData)

  doors.forEach((door, index) => {
    const qty = Math.min(99, Math.max(1, Math.trunc(door.quantity ?? 1) || 1))
    const scope = doorSupplyScope(door)
    const headrailLabel = formatProposalHeadrailLabel(door.headrail_type)
    const profileLabel = door.strip_type_label?.trim() || formatProposalStripTypeLine(door.strip_type)

    const blockHeight = scope === 'whole_door' ? 84 : 70

    // Door header bar
    drawRect(page, marginL, y - 18, contentWidth, 20, rgb(0.22, 0.22, 0.48))
    page.drawText(`Door ${index + 1}`, {
      x: marginL + 8,
      y: y - 13,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    })
    if (qty > 1) {
      page.drawText(`Qty: ${qty}`, {
        x: marginL + 60,
        y: y - 13,
        size: 10,
        font: regularFont,
        color: rgb(0.85, 0.85, 1),
      })
    }
    // Supply badge on the right
    const scopeText = scope === 'whole_door' ? 'Whole Door' : 'Strips Only'
    const scopeColor = scope === 'whole_door' ? rgb(0.15, 0.55, 0.35) : rgb(0.55, 0.35, 0.1)
    const badgeX = marginL + contentWidth - 80
    drawRect(page, badgeX, y - 17, 78, 16, scopeColor)
    page.drawText(scopeText, {
      x: badgeX + 6,
      y: y - 12,
      size: 8,
      font: boldFont,
      color: rgb(1, 1, 1),
    })

    y -= 22

    // Door body background
    drawRect(page, marginL, y - (blockHeight - 4), contentWidth, blockHeight - 4, rgb(0.975, 0.975, 0.99))

    // Two-column layout inside
    const leftX = marginL + 8
    const midX = marginL + contentWidth / 2
    const valOffL = 90
    const valOffR = 80

    // Row 1: Opening W × H | Headrail type
    page.drawText('Opening (W × H):', { x: leftX, y: y - 10, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
    page.drawText(`${door.width_mm} mm × ${door.height_mm} mm`, { x: leftX + valOffL, y: y - 10, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

    page.drawText('Headrail type:', { x: midX, y: y - 10, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
    page.drawText(headrailLabel, { x: midX + valOffR, y: y - 10, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

    // Row 2: Headrail length (if whole door) | Strip profile
    if (scope === 'whole_door') {
      page.drawText('Headrail length:', { x: leftX, y: y - 24, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(`${door.width_mm} mm`, { x: leftX + valOffL, y: y - 24, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

      page.drawText('Strip profile:', { x: midX, y: y - 24, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(profileLabel.slice(0, 32), { x: midX + valOffR, y: y - 24, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

      // Row 3: Strip size | Overlap
      page.drawText('Strip size:', { x: leftX, y: y - 38, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(`${door.strip_width_mm} mm × ${door.thickness_mm} mm`, { x: leftX + valOffL, y: y - 38, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

      page.drawText('Overlap:', { x: midX, y: y - 38, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(`${door.overlap_mm} mm`, { x: midX + valOffR, y: y - 38, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

      // Row 4: Strip count
      page.drawText('Strip count:', { x: leftX, y: y - 52, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(String(door.number_of_strips), { x: leftX + valOffL, y: y - 52, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

      y -= blockHeight
    } else {
      // Strips only: 3 rows
      page.drawText('Strip profile:', { x: leftX, y: y - 24, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(profileLabel.slice(0, 32), { x: leftX + valOffL, y: y - 24, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

      page.drawText('Strip size:', { x: midX, y: y - 24, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(`${door.strip_width_mm} mm × ${door.thickness_mm} mm`, { x: midX + valOffR, y: y - 24, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

      page.drawText('Strip count:', { x: leftX, y: y - 38, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(String(door.number_of_strips), { x: leftX + valOffL, y: y - 38, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

      page.drawText('Overlap:', { x: midX, y: y - 38, size: 9, font: boldFont, color: rgb(0.35, 0.35, 0.45) })
      page.drawText(`${door.overlap_mm} mm`, { x: midX + valOffR, y: y - 38, size: 9, font: regularFont, color: rgb(0.05, 0.05, 0.05) })

      y -= blockHeight
    }

    y -= 8
  })

  // ── Footer ───────────────────────────────────────────────────────────────
  y -= 6
  drawHLine(page, marginL, y, contentWidth, 0.4)
  y -= 12
  const printed = `Printed: ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}`
  page.drawText(printed, { x: marginL, y, size: 8, font: regularFont, color: rgb(0.55, 0.55, 0.55) })
  page.drawText('NBE Australia Pty Ltd · ABN 17 007 048 008', {
    x: pageWidth - marginR - 195,
    y,
    size: 8,
    font: regularFont,
    color: rgb(0.55, 0.55, 0.55),
  })

  return pdfDoc.save()
}
