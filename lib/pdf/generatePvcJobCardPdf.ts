import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ProposalDoor } from '@/lib/types/quote.types'
import {
  formatProposalHeadrailLabel,
  formatProposalStripTypeLine,
} from '@/lib/calculators/pvcQuoteLabels'
import { supplyScopeLabel } from '@/lib/pvc/pvcQuoteWorkflow'
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

export async function generatePvcJobCardPdf(input: PvcJobCardPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const roboto = await embedRobotoForPdfLib(pdfDoc)
  const boldFont = roboto?.bold ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
  const regularFont = roboto?.regular ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))

  const left = 40
  let y = 800

  const logoHeight = 40
  let logoDrawn = false
  try {
    const logoPath = path.join(process.cwd(), 'public', 'NBE_LOGO_BK_PL.png')
    const logoBytes = await readFile(logoPath)
    const logoImage = await pdfDoc.embedPng(logoBytes)
    const { width: nw, height: nh } = logoImage
    const logoWidth = (nw / nh) * logoHeight
    page.drawImage(logoImage, {
      x: left,
      y: y - logoHeight,
      width: logoWidth,
      height: logoHeight,
    })
    logoDrawn = true
  } catch {
    // fallback below
  }

  if (!logoDrawn) {
    page.drawText('NBE Australia', { x: left, y: y - 14, size: 14, font: boldFont })
  }

  page.drawText('NBE Australia', { x: 360, y: y - 6, size: 11, font: boldFont })
  page.drawText('Fact 22A Humeside Dr', { x: 360, y: y - 20, size: 10, font: regularFont })
  page.drawText('Campbellfield VIC 3061', { x: 360, y: y - 34, size: 10, font: regularFont })
  page.drawText('Ph: 03 9357 5858', { x: 360, y: y - 48, size: 10, font: regularFont })

  y -= 70

  page.drawText('PVC Strip Curtain — Job Card', {
    x: left,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.4),
  })

  y -= 28

  const details = input.quoteData.customerDetails || {}
  const rows: Array<[string, string]> = [
    ['Customer:', details.customer || ''],
    ['Attn:', details.attn || ''],
    ['Address:', details.address || ''],
    ['Date:', details.date || new Date().toLocaleDateString('en-AU')],
    ['Ref No:', details.refNo || ''],
    ['PO / Reference:', input.poReference?.trim() || ''],
    ['Assigned to:', input.assignedToName],
    ['Headrail length:', input.supplyScope === 'strips_only' || input.headrailLengthMm == null
      ? 'N/A (strips only)'
      : `${input.headrailLengthMm} mm`],
    ['Supply scope:', supplyScopeLabel(input.supplyScope)],
  ]

  rows.forEach(([label, value]) => {
    page.drawText(label, { x: left, y, size: 10, font: boldFont })
    page.drawText(value, { x: left + 110, y, size: 10, font: regularFont })
    y -= 14
  })

  if (input.approvalMessage?.trim()) {
    y -= 4
    page.drawText('Notes:', { x: left, y, size: 10, font: boldFont })
    y -= 14
    page.drawText(input.approvalMessage.trim().slice(0, 200), {
      x: left,
      y,
      size: 10,
      font: regularFont,
    })
    y -= 28
  }

  y -= 8
  page.drawText('Door specifications', { x: left, y, size: 12, font: boldFont })
  y -= 20

  const doors = deriveDoors(input.quoteData)
  doors.forEach((door, index) => {
    const headrailLabel = formatProposalHeadrailLabel(door.headrail_type)
    const profileLabel = door.strip_type_label?.trim() || formatProposalStripTypeLine(door.strip_type)
    const qty = Math.min(99, Math.max(1, Math.trunc(door.quantity ?? 1) || 1))

    const lines = [
      `Door ${index + 1} — Qty ${qty}`,
      `Opening ${door.height_mm} mm H × ${door.width_mm} mm W`,
      `Headrail ${headrailLabel}, ${door.overlap_mm} mm overlap`,
      `Strips ${door.strip_width_mm} mm × ${door.thickness_mm} mm — ${profileLabel}`,
      `Strip count: ${door.number_of_strips}`,
    ]

    lines.forEach(line => {
      page.drawText(line, { x: left, y, size: 10, font: regularFont })
      y -= 13
    })
    y -= 8
  })

  return pdfDoc.save()
}
