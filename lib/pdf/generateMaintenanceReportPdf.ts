import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import type { MaintenanceFormValues, MaintenanceDoorForm } from '@/lib/types/maintenance.types'
import type { MaintenanceChecklistItem } from '@/lib/types/maintenance.types'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 50
const HEADER_HEIGHT = 180
const FOOTER_MARGIN = 40
const PAGE_BREAK_Y = PAGE_HEIGHT - 720

const SECTION_COLOR = rgb(0.12, 0.24, 0.53)
const HEADER_FILL = rgb(0.9, 0.92, 0.95)

const INSPECTION_LEGEND =
  '01. Movement | 02. Fabric | 03. Stiffener | 04. View Window | 05. Straps & Buckles | 06. Upright | 07. Drum Cover | 08. Fixtures | 09. Cables | 10. Open & Close Height | 11. Hazard Light / Traffic Light | 12. Manual Mode | 13. Automatic Mode | 14. Interlock | 15. Push Button | 16. Sensors (Radar / Remote Control / Induction Loop) | 17. Photoelectric Cells | 18. Safety Edge | 19. Emergency Switch | 20. Control Box | 21. Conduit | 22. Gearbox | 23. Drive Shaft | 24. Bearing | 25. Limit Switch / Encoder | 26. Chain / Belt'

export type MaintenancePdfOptions = {
  form: MaintenanceFormValues
  clientName: string
  locationName: string
  reportNumber: string
  reportDate: string
  technicianEmail?: string
  technicianContact?: string
  logoBytes?: Uint8Array | null
  signatureBytes?: Uint8Array | null
  /** Per-door: array of image bytes (JPEG/PNG) for that door's photos */
  doorPhotoBytes?: (Uint8Array[])[] | null
  /** Optional TTF bytes for Unicode (checkmarks). If missing, uses text labels. */
  unicodeFontBytes?: Uint8Array | null
  /** Optional door diagram image bytes (PNG/JPEG) for page 1. */
  doorDiagramBytes?: Uint8Array | null
}

function formatTime(s: string): string {
  if (!s) return ''
  const part = String(s).trim()
  if (part.length >= 5) return part.slice(0, 5)
  return part
}

type PDFFontType = Awaited<ReturnType<PDFDocument['embedFont']>>
type PDFImageType = Awaited<ReturnType<PDFDocument['embedPng']>>

function drawCheck(page: PDFPage, x: number, y: number) {
  const color = rgb(0.5, 0.5, 0.5)

  page.drawLine({
    start: { x, y },
    end: { x: x + 3, y: y - 3 },
    thickness: 1.6,
    color,
  })

  page.drawLine({
    start: { x: x + 3, y: y - 3 },
    end: { x: x + 9, y: y + 5 },
    thickness: 1.6,
    color,
  })
}
function drawHeader(
  page: PDFPage,
  reportNumber: string,
  reportDate: string,
  logoImage: PDFImageType | null,
  font: PDFFontType,
  bold: PDFFontType
) {
  const logoX = 50
  const logoW = 120
  const logoH = 50
  const logoTop = PAGE_HEIGHT - 70

  const titleX = 200
  const titleY = PAGE_HEIGHT - 95

  const reportX = PAGE_WIDTH - 170
  const reportY = PAGE_HEIGHT - 45
  const dateY = PAGE_HEIGHT - 60

  const dividerY = PAGE_HEIGHT - 135

  if (logoImage) {
    page.drawImage(logoImage, {
      x: logoX,
      y: logoTop - logoH,
      width: logoW,
      height: logoH,
    })
  }

  page.drawText('NBE Maintenance Inspection Report', {
    x: titleX,
    y: titleY,
    size: 20,
    font: bold,
  })

  page.drawText(`Report: ${reportNumber}`, {
    x: reportX,
    y: reportY,
    size: 11,
    font,
  })

  page.drawText(`Date: ${reportDate}`, {
    x: reportX,
    y: dateY,
    size: 11,
    font,
  })

  page.drawLine({
    start: { x: 50, y: dividerY },
    end: { x: PAGE_WIDTH - 50, y: dividerY },
    thickness: 1,
  })
}
/** Returns new y position after drawing */
function drawCustomerInfo(
  page: PDFPage,
  form: MaintenanceFormValues,
  clientName: string,
  locationName: string,
  startY: number,
  font: PDFFontType,
  bold: PDFFontType
): number {
  let y = startY
  const x = MARGIN
  const labelWidth = 140

  const line = (label: string, value: string) => {
    page.drawText(label, { x, y, size: 10, font: bold, color: rgb(0.2, 0.2, 0.25) })
    page.drawText(value ?? '', { x: x + labelWidth, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    y -= 14
  }

  page.drawText('Customer Information', { x, y, size: 12, font: bold, color: rgb(0.1, 0.2, 0.45) })
  y -= 18

  line('Client', clientName)
  line('Location', locationName)
  line('Address', form.address)
  line('Inspection Date', form.inspection_date)
  line('Inspection Start', formatTime(form.inspection_start))
  line('Inspection End', formatTime(form.inspection_end))
  line('Technician', form.technician_name)
  line('Total Doors Inspected', String(form.total_doors))

  return y - 10
}

/** Draw door diagram: static image if provided, else placeholder boxes. Returns new y. */
function drawDoorDiagram(
  page: PDFPage,
  startY: number,
  totalDoors: number,
  font: PDFFontType,
  bold: PDFFontType,
  doorDiagramImage: PDFImageType | null
): number {
  let y = startY
  page.drawText('Door Diagram', { x: MARGIN, y, size: 14, font: bold, color: rgb(0.1, 0.2, 0.45) })
  y -= 20

  if (doorDiagramImage) {
    const diagramW = 350
    const scale = diagramW / doorDiagramImage.width
    const diagramH = doorDiagramImage.height * scale
    page.drawImage(doorDiagramImage, {
      x: 60,
      y: y - diagramH,
      width: diagramW,
      height: diagramH,
    })
    y -= diagramH + 24
    return y
  }

  const boxW = 120
  const boxH = 80
  const cols = Math.min(4, totalDoors)
  const rows = Math.ceil(totalDoors / cols)
  let drawY = y
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      if (i >= totalDoors) break
      const x = MARGIN + c * (boxW + 12)
      page.drawRectangle({ x, y: drawY - boxH, width: boxW, height: boxH, borderColor: rgb(0.6, 0.6, 0.65), borderWidth: 1 })
      page.drawText(`Door ${i + 1}`, { x: x + 8, y: drawY - boxH / 2 - 4, size: 9, font, color: rgb(0.3, 0.3, 0.35) })
    }
    drawY -= boxH + 8
  }
  y = drawY - 20
  return y
}

/** Draw inspection legend (Jotform-style) below door diagram. Returns new y. */
function drawInspectionLegend(page: PDFPage, startY: number, font: PDFFontType): number {
  let y = startY - 12
  const lineHeight = 10
  const maxCharsPerLine = 95
  const words = INSPECTION_LEGEND.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && next.length > maxCharsPerLine) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  for (const line of lines) {
    page.drawText(line, { x: MARGIN, y, size: 9, font, color: rgb(0.2, 0.2, 0.25) })
    y -= lineHeight
  }
  return y - 16
}

function groupChecklistBySection(
  items: MaintenanceChecklistItem[]
): { section: string; items: MaintenanceChecklistItem[] }[] {
  const map = new Map<string, MaintenanceChecklistItem[]>()
  for (const item of items) {
    const section = item.section || 'Other'
    if (!map.has(section)) map.set(section, [])
    map.get(section)!.push(item)
  }
  return Array.from(map.entries()).map(([section, items]) => ({ section, items }))
}

type ChecklistContext = {
  page: PDFPage
  pdf: PDFDocument
  reportNumber: string
  reportDate: string
  logoImage: PDFImageType | null
  font: PDFFontType
  bold: PDFFontType
  contentTop: number
}

function drawChecklistTable(
  ctx: ChecklistContext,
  door: MaintenanceDoorForm,
  startY: number
): { page: PDFPage; y: number } {
  const { page: initialPage, pdf, reportNumber, reportDate, logoImage, font, bold, contentTop } = ctx
  const colWidths = [300, 50, 50, 50, 50]
  const rowHeight = 16
  const x = MARGIN

  let page = initialPage
  let y = startY
  const groups = groupChecklistBySection(MAINTENANCE_CHECKLIST_ITEMS)

  const ensureSpace = (required: number) => {
    if (y < PAGE_BREAK_Y + required) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      drawHeader(page, reportNumber, reportDate, logoImage, font, bold)
      y = contentTop
    }
  }

  for (const { section, items } of groups) {
    ensureSpace(rowHeight * (items.length + 2) + 30)
    y -= 6
    page.drawText(`[ ${section} ]`, {
      x: MARGIN,
      y,
      size: 12,
      font: bold,
      color: SECTION_COLOR,
    })
    y -= 18

    const headerY = y
    const totalWidth = colWidths.reduce((a, b) => a + b, 0)
    page.drawRectangle({
      x,
      y: headerY - rowHeight,
      width: totalWidth,
      height: rowHeight,
      color: HEADER_FILL,
      borderColor: rgb(0.5, 0.5, 0.55),
      borderWidth: 0.5,
    })
    let cx = x
    const cols = ['Item', 'Good', 'Caution', 'Fault', 'N/A']
    for (let i = 0; i < cols.length; i++) {
      page.drawText(cols[i], { x: cx + 4, y: headerY - 12, size: 9, font: bold, color: rgb(0.2, 0.2, 0.25) })
      cx += colWidths[i]
    }
    y = headerY - rowHeight

    for (const item of items) {
      ensureSpace(rowHeight)
      const status = door.checklist[item.code] ?? null

      let cx2 = x
      const label = item.label.slice(0, 52) + (item.label.length > 52 ? '...' : '')
      page.drawText(label, { x: cx2 + 4, y: y - 10, size: 8, font, color: rgb(0.1, 0.1, 0.1) })
      cx2 += colWidths[0]
      if (status === 'good') {
        drawCheck(page, cx2 + colWidths[1] / 2 - 4, y - 8)
      }
      cx2 += colWidths[1]
      if (status === 'caution') {
        drawCheck(page, cx2 + colWidths[2] / 2 - 4, y - 8)
      }
      cx2 += colWidths[2]
      if (status === 'fault') {
        drawCheck(page, cx2 + colWidths[3] / 2 - 4, y - 8)
      }
      cx2 += colWidths[3]
      if (status === 'na') {
        drawCheck(page, cx2 + colWidths[4] / 2 - 4, y - 8)
      }
      cx2 += colWidths[4]

      cx2 = x
      for (const w of colWidths) {
        page.drawRectangle({
          x: cx2,
          y: y - rowHeight,
          width: w,
          height: rowHeight,
          borderColor: rgb(0.75, 0.75, 0.78),
          borderWidth: 0.3,
        })
        cx2 += w
      }
      y -= rowHeight
    }
    y -= 4
  }
  return { page, y: y - 10 }
}

/** Draw door notes section */
function drawDoorNotes(page: PDFPage, notes: string, startY: number, font: PDFFontType, bold: PDFFontType): number {
  let y = startY
  page.drawText('Door Notes', { x: MARGIN, y, size: 11, font: bold, color: rgb(0.1, 0.2, 0.45) })
  y -= 14
  const text = (notes || '-').trim() || '-'
  const lines: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= 90) {
      lines.push(remaining)
      break
    }
    lines.push(remaining.slice(0, 90))
    remaining = remaining.slice(90)
  }
  for (const line of lines) {
    if (y < FOOTER_MARGIN + 14) break
    page.drawText(line, { x: MARGIN, y, size: 9, font, color: rgb(0.15, 0.15, 0.2) })
    y -= 12
  }
  return y - 12
}

/** Draw image grid: 3 per row. imageRefs are embedded image refs. Returns new y. */
function drawImageGrid(
  page: PDFPage,
  imageRefs: { width: number; height: number; embed: PDFImageType }[],
  startY: number,
  imagesPerRow: number
): number {
  if (imageRefs.length === 0) return startY
  const cellSize = 140
  const gap = 8
  let y = startY
  let x = MARGIN
  let col = 0
  for (const img of imageRefs) {
    const scale = Math.min(cellSize / img.width, cellSize / img.height, 1)
    const w = img.width * scale
    const h = img.height * scale
    page.drawImage(img.embed, { x, y: y - h, width: w, height: h })
    col++
    if (col >= imagesPerRow) {
      col = 0
      x = MARGIN
      y -= cellSize + gap
      if (y < FOOTER_MARGIN + cellSize) break
    } else {
      x += cellSize + gap
    }
  }
  return y - 20
}

/** Draw signature section */
function drawSignature(
  page: PDFPage,
  form: MaintenanceFormValues,
  reportDate: string,
  signatureImage: PDFImageType | null,
  font: PDFFontType,
  bold: PDFFontType,
  technicianEmail?: string,
  technicianContact?: string,
  nextMaintenanceDate?: string,
): void {
  let y = 200
  const x = MARGIN
  page.drawText('Signature', { x, y, size: 12, font: bold, color: rgb(0.1, 0.2, 0.45) })
  y -= 18
  page.drawText('Checked by (Signature)', { x, y, size: 10, font: bold, color: rgb(0.2, 0.2, 0.25) })
  y -= 18
  if (signatureImage) {
    const maxH = 60
    const maxW = 200
    const scale = Math.min(maxW / signatureImage.width, maxH / signatureImage.height, 1)
    page.drawImage(signatureImage, {
      x,
      y: y - signatureImage.height * scale,
      width: signatureImage.width * scale,
      height: signatureImage.height * scale,
    })
    y -= signatureImage.height * scale + 16
  } else {
    page.drawText('(Signature image not available)', { x, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) })
    y -= 24
  }
  page.drawText('Name:', { x, y, size: 10, font: bold, color: rgb(0.2, 0.2, 0.25) })
  page.drawText(form.technician_name || '-', { x: x + 60, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
  y -= 14

  page.drawText('Email:', { x, y, size: 10, font: bold, color: rgb(0.2, 0.2, 0.25) })
  page.drawText(technicianEmail || '-', { x: x + 60, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
  y -= 14

  page.drawText('Contact:', { x, y, size: 10, font: bold, color: rgb(0.2, 0.2, 0.25) })
  page.drawText(technicianContact || '-', { x: x + 60, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
  y -= 14

  page.drawText('Date:', { x, y, size: 10, font: bold, color: rgb(0.2, 0.2, 0.25) })
  page.drawText(reportDate, { x: x + 60, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
  y -= 14

  page.drawText('Next Maintenance Service Date:', {
    x,
    y,
    size: 10,
    font: bold,
    color: rgb(0.2, 0.2, 0.25),
  })
  page.drawText(nextMaintenanceDate || '-', {
    x: x + 210,
    y,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })
}

export async function generateMaintenanceReportPdf(options: MaintenancePdfOptions): Promise<Uint8Array> {
  const {
    form,
    clientName,
    locationName,
    reportNumber,
    reportDate,
    logoBytes,
    signatureBytes,
    doorPhotoBytes,
    doorDiagramBytes,
    technicianEmail,
    technicianContact,
  } = options
  const pdf = await PDFDocument.create()

  let font: PDFFontType = await pdf.embedFont(StandardFonts.Helvetica)
  let bold: PDFFontType = await pdf.embedFont(StandardFonts.HelveticaBold)

  let logoImage: PDFImageType | null = null
  if (logoBytes && logoBytes.length > 0) {
    try {
      logoImage = await pdf.embedPng(logoBytes)
    } catch {
      try {
        logoImage = await pdf.embedJpg(logoBytes)
      } catch {
        // leave null
      }
    }
  }

  let signatureImage: PDFImageType | null = null
  if (signatureBytes && signatureBytes.length > 0) {
    try {
      signatureImage = await pdf.embedPng(signatureBytes)
    } catch {
      try {
        signatureImage = await pdf.embedJpg(signatureBytes)
      } catch {
        // leave null
      }
    }
  }

  let doorDiagramImage: PDFImageType | null = null
  if (doorDiagramBytes && doorDiagramBytes.length > 0) {
    try {
      doorDiagramImage = await pdf.embedPng(doorDiagramBytes)
    } catch {
      try {
        doorDiagramImage = await pdf.embedJpg(doorDiagramBytes)
      } catch {
        // leave null
      }
    }
  }

  const contentStartY = PAGE_HEIGHT - HEADER_HEIGHT
  const contentTop = contentStartY

  // ----- Page 1: Header, Customer Information, Door Diagram, Legend -----
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  drawHeader(page, reportNumber, reportDate, logoImage, font, bold)
  let y = contentStartY
  y = drawCustomerInfo(page, form, clientName, locationName, y, font, bold)
  y = drawDoorDiagram(page, y, form.total_doors, font, bold, doorDiagramImage)
  y = drawInspectionLegend(page, y, font)

  // ----- Page 2+ : One section (or page) per door -----
  const photoBytesByDoor = doorPhotoBytes ?? form.doors.map(() => [])

  for (let doorIndex = 0; doorIndex < form.doors.length; doorIndex++) {
    const door = form.doors[doorIndex]
    const needNewPage = true
    if (needNewPage) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      drawHeader(page, reportNumber, reportDate, logoImage, font, bold)
      y = contentStartY
    }

    page.drawText(`${door.door_number || `Door ${doorIndex + 1}`}`, { x: MARGIN, y, size: 14, font: bold, color: rgb(0.1, 0.2, 0.45) })
    y -= 18
    page.drawText(`Door Type: ${door.door_type || '-'}  |  Cycles: ${door.door_cycles}  |  View Window Visibility: ${door.view_window_visibility}%`, {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.25),
    })
    y -= 20

    const checklistCtx: ChecklistContext = {
      page,
      pdf,
      reportNumber,
      reportDate,
      logoImage,
      font,
      bold,
      contentTop,
    }
    const checklistResult = drawChecklistTable(checklistCtx, door, y)
    page = checklistResult.page
    y = checklistResult.y
    y = drawDoorNotes(page, door.notes, y, font, bold)

    const doorPhotos = photoBytesByDoor[doorIndex] ?? []
    const imageRefs: { width: number; height: number; embed: PDFImageType }[] = []
    for (const bytes of doorPhotos) {
      try {
        const img = await pdf.embedPng(bytes)
        imageRefs.push({ width: img.width, height: img.height, embed: img })
      } catch {
        try {
          const img = await pdf.embedJpg(bytes)
          imageRefs.push({ width: img.width, height: img.height, embed: img })
        } catch {
          // skip failed image
        }
      }
    }
    if (imageRefs.length > 0) {
      page.drawText('Uploaded Photos', { x: MARGIN, y, size: 11, font: bold, color: rgb(0.1, 0.2, 0.45) })
      y -= 16
      y = drawImageGrid(page, imageRefs, y, 3)
    }
    y -= 20
  }

  // ----- Last page: Signature -----
  page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  drawHeader(page, reportNumber, reportDate, logoImage, font, bold)

  let nextMaintenanceDate = ''
  if (form.inspection_date) {
    const d = new Date(form.inspection_date)
    if (!Number.isNaN(d.getTime())) {
      d.setMonth(d.getMonth() + 6)
      nextMaintenanceDate = d.toISOString().slice(0, 10)
    }
  }

  drawSignature(page, form, reportDate, signatureImage, font, bold, technicianEmail, technicianContact, nextMaintenanceDate)

  return pdf.save()
}
