import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import type {
  MaintenanceFormValues,
  MaintenanceDoorForm,
  MaintenanceChecklistItem,
  MaintenanceChecklistStatus,
} from '@/lib/types/maintenance.types'
import { wrapPdfTextLines } from '@/lib/pdf/pdfTextWrap'
import { savePdfBytes } from '@/lib/pdf/savePdf'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'
import { DOOR_DIAGRAM_LEGEND_ITEMS } from '@/lib/maintenance/doorDiagramLegend'
import {
  BORDER_LIGHT,
  CELL_CAUTION,
  CELL_FAULT,
  CELL_GOOD,
  CELL_NA,
  CHECKLIST_BODY_FONT,
  CHECKLIST_HEADER_FONT,
  CHECKLIST_HEADER_HEIGHT,
  CHECKLIST_ITEM_COL,
  CHECKLIST_ROW_HEIGHT,
  CHECKLIST_STAT_COL,
  CUSTOMER_COL_GAP,
  CUSTOMER_LABEL_WIDTH,
  CUSTOMER_LINE_HEIGHT,
  CUSTOMER_ROW_GAP,
  DOOR_META_BOTTOM,
  DOOR_META_SIZE,
  DOOR_TITLE_GAP,
  FOOTER_MARGIN,
  HDR_CAUTION,
  HDR_FAULT,
  HDR_GOOD,
  HDR_ITEM,
  HDR_NA,
  HEADER_FILL,
  HEADER_HEIGHT,
  HEADER_RULE_GRAY,
  MARK_CAUTION,
  MARK_FAULT,
  MARK_GOOD,
  MARK_NA,
  MARGIN,
  PAGE_BREAK_Y,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PHOTO_THUMB_MAX_PT,
  ROW_ALT_FILL,
  SECTION_COLOR,
  SECTION_FIRST_TOP,
  SECTION_GAP_BETWEEN,
  SECTION_TITLE_TO_TABLE,
  TABLE_SECTION_TAIL,
} from '@/lib/pdf/layouts/maintenancePageMetrics'
import { formatMaintenancePdfTime as formatTime } from '@/lib/pdf/utils/formatMaintenancePdfTime'
import { aggregateSignOffDisplayMetrics, buildSignOffFindingGroups } from '@/lib/maintenance/reportMetrics'
import { generateMergedReportSignaturePdf } from '@/lib/pdf/mergedReportSignaturePagePdf'
import { loadNbeLogoBytes } from '@/lib/pdf/loadNbeLogo'

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
  /**
   * Merged multi-report PDF: first segment can show a manager-entered total; later segments omit the row.
   */
  mergedTotalDoorsCustomerInfo?: {
    omitLine: boolean
    /** When omitLine is false and set, overrides form.total_doors for the customer-info row only */
    displayValue?: number
  }
  /** Optional QR PNG for cover page (e.g. link to online report) */
  coverQrPngBytes?: Uint8Array | null
}

/** Pages before door detail: single intro (digital report + client info + door diagram). Used by merge. */
export const MAINTENANCE_PDF_PREFIX_PAGES = 1

type PDFFontType = Awaited<ReturnType<PDFDocument['embedFont']>>
type PDFImageType = Awaited<ReturnType<PDFDocument['embedPng']>>

/** Small vector checkmark (green-style marks) */
function drawCheckMark(page: PDFPage, cx: number, baselineY: number, color = MARK_GOOD, size = 1) {
  const x = cx - 4 * size
  const y = baselineY + 1
  page.drawLine({
    start: { x, y },
    end: { x: x + 3 * size, y: y - 3 * size },
    thickness: 1.5 * size,
    color,
  })
  page.drawLine({
    start: { x: x + 3 * size, y: y - 3 * size },
    end: { x: x + 9 * size, y: y + 5 * size },
    thickness: 1.5 * size,
    color,
  })
}

function drawXMark(page: PDFPage, cx: number, baselineY: number, color: ReturnType<typeof rgb>) {
  const s = 4
  const y = baselineY + 2
  page.drawLine({
    start: { x: cx - s, y: y + s },
    end: { x: cx + s, y: y - s },
    thickness: 1.6,
    color,
  })
  page.drawLine({
    start: { x: cx - s, y: y - s },
    end: { x: cx + s, y: y + s },
    thickness: 1.6,
    color,
  })
}

function countDoorChecklist(door: MaintenanceDoorForm): { good: number; caution: number; fault: number } {
  let good = 0
  let caution = 0
  let fault = 0
  for (const item of MAINTENANCE_CHECKLIST_ITEMS) {
    const s = door.checklist[item.code] ?? null
    if (s === 'good') good += 1
    else if (s === 'caution') caution += 1
    else if (s === 'fault') fault += 1
  }
  return { good, caution, fault }
}

/** Page 1: logo + title + QR, client & inspection grid, door diagram, divider (no inspection/executive summary pages). */
function drawReportFirstPage(
  page: PDFPage,
  params: {
    clientName: string
    locationName: string
    form: MaintenanceFormValues
    logoImage: PDFImageType | null
    qrImage: PDFImageType | null
    doorDiagramImage: PDFImageType | null
    mergedTotalDoorsCustomerInfo?: MaintenancePdfOptions['mergedTotalDoorsCustomerInfo']
  },
  font: PDFFontType,
  bold: PDFFontType,
): void {
  const { clientName, locationName, form, logoImage, qrImage, doorDiagramImage, mergedTotalDoorsCustomerInfo } = params

  if (logoImage) {
    const lw = 100
    const lh = Math.min(40, (logoImage.height / logoImage.width) * lw)
    page.drawImage(logoImage, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - lh,
      width: lw,
      height: lh,
    })
  }

  const mainTitle = 'Maintenance Inspection Report'
  const titleSize = 15
  const tw = bold.widthOfTextAtSize(mainTitle, titleSize)
  page.drawText(mainTitle, {
    x: (PAGE_WIDTH - tw) / 2,
    y: PAGE_HEIGHT - MARGIN - 26,
    size: titleSize,
    font: bold,
    color: SECTION_COLOR,
  })

  const qs = 72
  let hintBottomY: number | null = null
  if (qrImage) {
    const qx = PAGE_WIDTH - MARGIN - qs
    const qy = PAGE_HEIGHT - MARGIN - qs
    page.drawImage(qrImage, { x: qx, y: qy, width: qs, height: qs })
    const hint = 'Scan to view digital report'
    const hw = font.widthOfTextAtSize(hint, 7)
    const hintBaselineY = qy - 8
    page.drawText(hint, {
      x: qx + (qs - hw) / 2,
      y: hintBaselineY,
      size: 7,
      font,
      color: rgb(0.45, 0.47, 0.52),
    })
    hintBottomY = hintBaselineY - 8
  }

  /** mt-4 (16pt) below header content, same gray as Tailwind border-gray-300 */
  const mtBeforeHeaderRule = 16
  const mbAfterHeaderRule = 24
  const headerDividerY =
    hintBottomY !== null ? hintBottomY - mtBeforeHeaderRule : PAGE_HEIGHT - 135

  page.drawLine({
    start: { x: MARGIN, y: headerDividerY },
    end: { x: PAGE_WIDTH - MARGIN, y: headerDividerY },
    thickness: 1,
    color: HEADER_RULE_GRAY,
  })

  let y = headerDividerY - mbAfterHeaderRule - 2
  page.drawText('Site & inspection overview', {
    x: MARGIN,
    y,
    size: 12,
    font: bold,
    color: SECTION_COLOR,
  })
  y -= 20
  y = drawCustomerInfo(page, form, clientName, locationName, y, font, bold, mergedTotalDoorsCustomerInfo)
  y = drawDoorDiagram(page, y, form.total_doors, font, bold, doorDiagramImage)

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.75,
    color: rgb(0.72, 0.74, 0.78),
  })
}

/** Right-aligned status badge aligned to door title baseline */
function drawDoorStatusBadge(
  page: PDFPage,
  titleBaseline: number,
  door: MaintenanceDoorForm,
  bold: PDFFontType,
): void {
  const c = countDoorChecklist(door)
  let text = 'ALL GOOD'
  let bg = rgb(0.9, 0.98, 0.93)
  let fg = rgb(0.08, 0.45, 0.28)
  if (c.fault > 0) {
    text = `FAULT DETECTED (${c.fault})`
    bg = rgb(1, 0.93, 0.93)
    fg = rgb(0.75, 0.12, 0.12)
  } else if (c.caution > 0) {
    text = 'CAUTION'
    bg = rgb(1, 0.97, 0.88)
    fg = rgb(0.65, 0.45, 0.05)
  }
  const fs = 7.5
  const padX = 6
  const padY = 3
  const tw = bold.widthOfTextAtSize(text, fs)
  const w = tw + padX * 2
  const h = fs + padY * 2
  const right = PAGE_WIDTH - MARGIN
  const x = right - w
  const bottom = titleBaseline - 2
  page.drawRectangle({
    x,
    y: bottom - h,
    width: w,
    height: h,
    color: bg,
    borderColor: rgb(0.82, 0.84, 0.88),
    borderWidth: 0.35,
  })
  page.drawText(text, {
    x: x + padX,
    y: bottom - padY - fs + 1,
    size: fs,
    font: bold,
    color: fg,
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
    size: 14,
    font: bold,
    color: SECTION_COLOR,
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
    color: HEADER_RULE_GRAY,
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
  bold: PDFFontType,
  mergedTotalDoors?: MaintenancePdfOptions['mergedTotalDoorsCustomerInfo']
): number {
  let y = startY
  const x = MARGIN
  const valueX = x + CUSTOMER_LABEL_WIDTH + CUSTOMER_COL_GAP
  const valueMaxWidth = PAGE_WIDTH - MARGIN - valueX
  const labelMaxWidth = CUSTOMER_LABEL_WIDTH

  const drawRow = (label: string, value: string) => {
    const labelLines =
      font.widthOfTextAtSize(label, 10) <= labelMaxWidth
        ? [label]
        : wrapPdfTextLines(label, bold, 10, labelMaxWidth)
    const valueLines = wrapPdfTextLines(value, font, 10, valueMaxWidth)

    const rowCount = Math.max(labelLines.length, valueLines.length)
    for (let i = 0; i < rowCount; i += 1) {
      const lineY = y - i * CUSTOMER_LINE_HEIGHT
      const lb = labelLines[i]
      if (lb) {
        page.drawText(lb, { x, y: lineY, size: 10, font: bold, color: rgb(0.2, 0.2, 0.25) })
      }
      const vl = valueLines[i]
      if (vl) {
        page.drawText(vl, { x: valueX, y: lineY, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
      }
    }
    y -= rowCount * CUSTOMER_LINE_HEIGHT + CUSTOMER_ROW_GAP
  }

  drawRow('Client', clientName)
  drawRow('Location', locationName)
  drawRow('Address', form.address)
  drawRow('Inspection Date', form.inspection_date)
  drawRow('Inspection Start', formatTime(form.inspection_start))
  drawRow('Inspection End', formatTime(form.inspection_end))
  drawRow('Technician', form.technician_name)
  if (mergedTotalDoors?.omitLine !== true) {
    const doorsStr =
      mergedTotalDoors?.displayValue != null && Number.isFinite(mergedTotalDoors.displayValue)
        ? String(Math.floor(mergedTotalDoors.displayValue))
        : String(form.total_doors)
    drawRow('Total Doors Inspected', doorsStr)
  }

  return y - 10
}

function formatDoorCyclesPdf(cycles: number | undefined | null): string {
  const n = Number(cycles)
  return n > 0 && !Number.isNaN(n) ? String(Math.floor(n)) : 'N/A'
}

/** Legend metrics — must stay in sync between measure and draw. */
type DoorLegendLayout = {
  legendSize: number
  lineHeight: number
  rowGap: number
  titleSize: number
  titleBottomGap: number
  dividerGap: number
  colGap: number
  cols: number
  tailPad: number
}

const DOOR_LEGEND_TAIL_PAD = 4

function measureDoorDiagramLegendHeight(font: PDFFontType, layout: DoorLegendLayout): number {
  const { legendSize, lineHeight, rowGap, titleSize, titleBottomGap, dividerGap, colGap, cols } = layout
  const maxW = PAGE_WIDTH - MARGIN * 2
  const colW = (maxW - colGap * (cols - 1)) / cols
  const items = [...DOOR_DIAGRAM_LEGEND_ITEMS]
  const rowCount = Math.ceil(items.length / cols)

  let h = titleSize + titleBottomGap + dividerGap
  for (let r = 0; r < rowCount; r++) {
    let maxLines = 1
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      if (idx >= items.length) continue
      const sub = wrapPdfTextLines(items[idx]!, font, legendSize, colW)
      maxLines = Math.max(maxLines, sub.length)
    }
    h += maxLines * lineHeight + rowGap
  }
  return h + layout.tailPad
}

/** Pick compact legend typography so the block fits `maxHeight` (25% slot of fixed door section). */
function resolveDoorLegendLayout(font: PDFFontType, maxHeight: number): DoorLegendLayout {
  const base: Omit<DoorLegendLayout, 'legendSize' | 'lineHeight' | 'rowGap'> = {
    titleSize: 7.5,
    titleBottomGap: 3,
    dividerGap: 5,
    colGap: 14,
    cols: 2,
    tailPad: DOOR_LEGEND_TAIL_PAD,
  }

  for (let legendSize = 7.5; legendSize >= 5; legendSize -= 0.25) {
    const lineHeight = Math.max(1, Math.ceil(legendSize * 1.22))
    const rowGap = Math.max(1, Math.round(legendSize * 0.28))
    const layout: DoorLegendLayout = { ...base, legendSize, lineHeight, rowGap }
    if (measureDoorDiagramLegendHeight(font, layout) <= maxHeight) return layout
  }

  const legendSize = 5
  const lineHeight = Math.max(1, Math.ceil(legendSize * 1.28))
  const rowGap = 2
  return { ...base, legendSize, lineHeight, rowGap }
}

/** ~520 CSS px — matches UI fixed door block; 75/25 split keeps diagram primary, legend compact. */
const DOOR_DIAGRAM_BLOCK_MAX_PT = (520 * 72) / 96
const DOOR_IMAGE_SHARE = 0.75
const DOOR_LEGEND_SHARE = 0.25
const DOOR_BLOCK_LAYOUT_PAD = 8
const DOOR_SECTION_TITLE_GAP = 18
const DOOR_IMG_TO_LEGEND_GAP = 6

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
  page.drawText('Door Diagram', { x: MARGIN, y, size: 13, font: bold, color: SECTION_COLOR })
  y -= DOOR_SECTION_TITLE_GAP

  const yAfterTitle = y
  const maxBlock =
    yAfterTitle - PAGE_BREAK_Y - DOOR_BLOCK_LAYOUT_PAD
  const blockH = Math.min(DOOR_DIAGRAM_BLOCK_MAX_PT, Math.max(120, maxBlock))
  const inner = blockH - DOOR_IMG_TO_LEGEND_GAP
  const imageMaxH = inner * DOOR_IMAGE_SHARE
  const legendMaxH = inner * DOOR_LEGEND_SHARE
  const legendLayout = resolveDoorLegendLayout(font, legendMaxH)

  if (doorDiagramImage) {
    const maxW = PAGE_WIDTH - MARGIN * 2
    const iw = doorDiagramImage.width
    const ih = doorDiagramImage.height
    const scale = Math.min(maxW / iw, imageMaxH / ih)
    const diagramW = iw * scale
    const diagramH = ih * scale
    const x0 = MARGIN + (maxW - diagramW) / 2
    page.drawImage(doorDiagramImage, {
      x: x0,
      y: y - diagramH,
      width: diagramW,
      height: diagramH,
    })
    y -= diagramH + DOOR_IMG_TO_LEGEND_GAP
    y = drawDoorDiagramLegend(page, y, font, bold, legendLayout)
    return y
  }

  const cols = Math.min(4, Math.max(1, totalDoors || 1))
  const rows = totalDoors > 0 ? Math.ceil(totalDoors / cols) : 0
  const boxW = Math.min(120, (PAGE_WIDTH - MARGIN * 2 - (cols - 1) * 12) / cols)
  const rowGapBoxes = 8
  const availGridH = Math.max(40, imageMaxH - 16)
  const boxH =
    rows > 0
      ? Math.max(32, Math.min(80, (availGridH - (rows - 1) * rowGapBoxes) / rows))
      : 32
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
  y = drawY - 12
  y = drawDoorDiagramLegend(page, y, font, bold, legendLayout)
  return y
}

/** Legend under diagram: titled section, divider, 2-column grid; each item wraps only within its column. */
function drawDoorDiagramLegend(
  page: PDFPage,
  startY: number,
  font: PDFFontType,
  bold: PDFFontType,
  layout: DoorLegendLayout
): number {
  let y = startY
  const { legendSize, lineHeight, rowGap, titleSize, titleBottomGap, dividerGap, colGap, cols, tailPad } = layout
  const maxW = PAGE_WIDTH - MARGIN * 2
  const colW = (maxW - colGap * (cols - 1)) / cols
  const legendColor = rgb(0.42, 0.44, 0.48)
  const titleColor = SECTION_COLOR

  page.drawText('Door Legend', {
    x: MARGIN,
    y,
    size: titleSize,
    font: bold,
    color: titleColor,
  })
  y -= titleSize + titleBottomGap

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.6,
    color: BORDER_LIGHT,
  })
  y -= dividerGap

  const items = [...DOOR_DIAGRAM_LEGEND_ITEMS]
  const rows = Math.ceil(items.length / cols)

  for (let r = 0; r < rows; r++) {
    const rowTopY = y
    let maxLines = 1
    const wrappedCols: string[][] = []

    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      if (idx >= items.length) {
        wrappedCols.push([])
        continue
      }
      const sub = wrapPdfTextLines(items[idx]!, font, legendSize, colW)
      wrappedCols.push(sub)
      maxLines = Math.max(maxLines, sub.length)
    }

    for (let c = 0; c < cols; c++) {
      const sub = wrappedCols[c]!
      if (sub.length === 0) continue
      const x = MARGIN + c * (colW + colGap)
      let lineY = rowTopY
      for (const line of sub) {
        page.drawText(line, {
          x,
          y: lineY,
          size: legendSize,
          font,
          color: legendColor,
        })
        lineY -= lineHeight
      }
    }

    y = rowTopY - maxLines * lineHeight - rowGap
  }

  return y - tailPad
}

/** e.g. "A. CURTAIN" → "A. Curtain", "C. OPEN / CLOSE FUNCTION" → "C. Open / Close Function" */
function formatSectionHeading(section: string): string {
  const s = section.trim()
  const m = s.match(/^([A-Z]\.\s*)(.+)$/i)
  if (!m) return s
  const rest = m[2]!.trim()
  const segments = rest.split(/\s*\/\s*/)
  const titled = segments
    .map(seg =>
      seg
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map(w => {
          if (w === '&') return '&'
          if (!w) return w
          return w.charAt(0).toUpperCase() + w.slice(1)
        })
        .join(' ')
    )
    .join(' / ')
  return `${m[1]!.trimEnd()} ${titled}`
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

function buildSectionSummaryLine(
  items: MaintenanceChecklistItem[],
  checklist: Record<string, MaintenanceChecklistStatus | null>,
): string {
  let g = 0
  let c = 0
  let f = 0
  let n = 0
  for (const item of items) {
    const s = checklist[item.code] ?? null
    if (s === 'good') g++
    else if (s === 'caution') c++
    else if (s === 'fault') f++
    else if (s === 'na') n++
  }
  const parts = [`${g} Good`, `${c} Caution`, `${f} Fault`]
  if (n > 0) parts.push(`${n} N/A`)
  return parts.join('  |  ')
}

/** Section title + optional per-section counts (engineering report style) */
function drawSectionHeader(
  page: PDFPage,
  y: number,
  titleText: string,
  summaryLine: string | null,
  font: PDFFontType,
  bold: PDFFontType,
): number {
  page.drawText(titleText, {
    x: MARGIN,
    y: y - 10,
    size: 12,
    font: bold,
    color: SECTION_COLOR,
  })
  if (summaryLine?.trim()) {
    page.drawText(summaryLine.trim(), {
      x: MARGIN,
      y: y - 23,
      size: 7.5,
      font,
      color: rgb(0.42, 0.44, 0.5),
    })
    return y - 34 - SECTION_TITLE_TO_TABLE
  }
  return y - 14 - SECTION_TITLE_TO_TABLE
}

function drawChecklistTable(
  ctx: ChecklistContext,
  door: MaintenanceDoorForm,
  startY: number
): { page: PDFPage; y: number } {
  const { page: initialPage, pdf, reportNumber, reportDate, logoImage, font, bold, contentTop } = ctx
  const colWidths = [
    CHECKLIST_ITEM_COL,
    CHECKLIST_STAT_COL,
    CHECKLIST_STAT_COL,
    CHECKLIST_STAT_COL,
    CHECKLIST_STAT_COL,
  ]
  const rowHeight = CHECKLIST_ROW_HEIGHT
  const x = MARGIN
  const headerLabels: { text: string; color: ReturnType<typeof rgb> }[] = [
    { text: 'Item', color: HDR_ITEM },
    { text: 'Good', color: HDR_GOOD },
    { text: 'Caution', color: HDR_CAUTION },
    { text: 'Fault', color: HDR_FAULT },
    { text: 'N/A', color: HDR_NA },
  ]

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

  for (let gi = 0; gi < groups.length; gi++) {
    const { section, items } = groups[gi]!

    /** Engineering layout: A+B on first checklist spread; C–E start on a fresh page when possible. */
    if (gi === 2) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      drawHeader(page, reportNumber, reportDate, logoImage, font, bold)
      y = contentTop
    }

    const summaryLine = buildSectionSummaryLine(items, door.checklist)
    const headerBlockExtra = 18
    const estRows = items.length + 2
    ensureSpace(
      rowHeight * estRows +
        CHECKLIST_HEADER_HEIGHT +
        SECTION_GAP_BETWEEN +
        headerBlockExtra +
        28,
    )

    if (gi === 0) {
      y -= SECTION_FIRST_TOP
    } else if (gi === 2) {
      y -= SECTION_FIRST_TOP
    } else {
      y -= SECTION_GAP_BETWEEN
    }

    const heading = formatSectionHeading(section)
    y = drawSectionHeader(page, y, heading, summaryLine, font, bold)

    const headerY = y
    const totalWidth = colWidths.reduce((a, b) => a + b, 0)
    page.drawRectangle({
      x,
      y: headerY - CHECKLIST_HEADER_HEIGHT,
      width: totalWidth,
      height: CHECKLIST_HEADER_HEIGHT,
      color: HEADER_FILL,
      borderColor: BORDER_LIGHT,
      borderWidth: 0.3,
    })
    const headerFontSize = CHECKLIST_HEADER_FONT
    let cx = x
    for (let i = 0; i < headerLabels.length; i++) {
      const { text: label, color: hdrColor } = headerLabels[i]!
      const w = colWidths[i]!
      const tw = bold.widthOfTextAtSize(label, headerFontSize)
      const ty = headerY - 10
      const tx = i === 0 ? cx + 6 : cx + (w - tw) / 2
      page.drawText(label, {
        x: tx,
        y: ty,
        size: headerFontSize,
        font: bold,
        color: hdrColor,
      })
      cx += w
    }
    y = headerY - CHECKLIST_HEADER_HEIGHT

    let rowIdx = 0
    for (const item of items) {
      ensureSpace(rowHeight)
      const status = door.checklist[item.code] ?? null
      const baseFill = rowIdx % 2 === 1 ? ROW_ALT_FILL : rgb(1, 1, 1)

      const cellFill = (col: number): ReturnType<typeof rgb> => {
        if (col === 0) return baseFill
        if (status === 'good' && col === 1) return CELL_GOOD
        if (status === 'caution' && col === 2) return CELL_CAUTION
        if (status === 'fault' && col === 3) return CELL_FAULT
        if (status === 'na' && col === 4) return CELL_NA
        return baseFill
      }

      let cx2 = x
      for (let col = 0; col < colWidths.length; col++) {
        const w = colWidths[col]!
        page.drawRectangle({
          x: cx2,
          y: y - rowHeight,
          width: w,
          height: rowHeight,
          color: cellFill(col),
          borderColor: BORDER_LIGHT,
          borderWidth: 0.25,
        })
        cx2 += w
      }

      const label = item.label.slice(0, 52) + (item.label.length > 52 ? '...' : '')
      const textBaseline = y - rowHeight / 2 - 1
      page.drawText(label, {
        x: x + 6,
        y: textBaseline,
        size: CHECKLIST_BODY_FONT,
        font,
        color: rgb(0.15, 0.16, 0.18),
      })

      const markY = y - rowHeight / 2 + 1
      const centerX = (col: number) => x + colWidths.slice(0, col).reduce((a, b) => a + b, 0) + colWidths[col]! / 2

      if (status === 'good') {
        drawCheckMark(page, centerX(1), markY, MARK_GOOD, 0.95)
      } else if (status === 'caution') {
        const tw = bold.widthOfTextAtSize('!', 10)
        page.drawText('!', {
          x: centerX(2) - tw / 2,
          y: markY - 1,
          size: 10,
          font: bold,
          color: MARK_CAUTION,
        })
      } else if (status === 'fault') {
        drawXMark(page, centerX(3), markY - 2, MARK_FAULT)
      } else if (status === 'na') {
        const em = '-'
        const tw = font.widthOfTextAtSize(em, 9)
        page.drawText(em, {
          x: centerX(4) - tw / 2,
          y: markY - 1,
          size: 9,
          font: bold,
          color: MARK_NA,
        })
      }

      y -= rowHeight
      rowIdx += 1
    }
    y -= TABLE_SECTION_TAIL
  }
  return { page, y: y - 8 }
}

/** Door notes — highlighted callout (yellow panel + left accent) */
function drawDoorNotes(page: PDFPage, notes: string, startY: number, font: PDFFontType, bold: PDFFontType): number {
  let y = startY
  page.drawText('Door Notes', { x: MARGIN, y, size: 12, font: bold, color: SECTION_COLOR })
  y -= 18
  const raw = (notes || '').trim()
  const text = raw || '-'
  const prefix = raw ? 'Attention: ' : ''
  const full = prefix + text
  const lines: string[] = []
  let remaining = full
  while (remaining.length > 0) {
    if (remaining.length <= 88) {
      lines.push(remaining)
      break
    }
    lines.push(remaining.slice(0, 88))
    remaining = remaining.slice(88)
  }

  const pad = 10
  const accentW = 3.5
  const lineH = 11
  const innerW = PAGE_WIDTH - MARGIN * 2 - pad * 2 - accentW
  const boxLines = lines.length
  const boxH = pad * 2 + boxLines * lineH + 4

  const boxBottom = y - boxH
  page.drawRectangle({
    x: MARGIN,
    y: boxBottom,
    width: PAGE_WIDTH - MARGIN * 2,
    height: boxH,
    color: rgb(1, 0.99, 0.92),
    borderColor: rgb(0.92, 0.82, 0.45),
    borderWidth: 0.4,
  })
  page.drawRectangle({
    x: MARGIN,
    y: boxBottom,
    width: accentW,
    height: boxH,
    color: rgb(0.95, 0.78, 0.2),
  })

  let ly = y - pad - 9
  for (const line of lines) {
    if (ly < FOOTER_MARGIN + 20) break
    page.drawText(line, {
      x: MARGIN + accentW + pad,
      y: ly,
      size: 9,
      font,
      color: rgb(0.22, 0.2, 0.12),
    })
    ly -= lineH
  }
  return boxBottom - 14
}

type PhotoGridLayout = {
  pdf: PDFDocument
  reportNumber: string
  reportDate: string
  logoImage: PDFImageType | null
  font: PDFFontType
  bold: PDFFontType
  contentTop: number
}

/**
 * Photo grid: capped thumbnails, never splits a row across pages; continues on new pages with header.
 */
function drawImageGrid(
  page: PDFPage,
  startY: number,
  imageRefs: { width: number; height: number; embed: PDFImageType }[],
  imagesPerRow: number,
  layout: PhotoGridLayout
): { page: PDFPage; y: number } {
  if (imageRefs.length === 0) return { page, y: startY }

  const gap = 8
  const usable = PAGE_WIDTH - MARGIN * 2 - gap * (imagesPerRow - 1)
  const rawCell = usable / imagesPerRow
  const cellSize = Math.min(rawCell, PHOTO_THUMB_MAX_PT)
  const rowStep = cellSize + gap
  const minYToStartRow = FOOTER_MARGIN + cellSize + 10

  let pageRef = page
  let y = startY
  let x = MARGIN
  let col = 0

  const startNewPhotoPage = () => {
    pageRef = layout.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    drawHeader(
      pageRef,
      layout.reportNumber,
      layout.reportDate,
      layout.logoImage,
      layout.font,
      layout.bold
    )
    y = layout.contentTop - 8
  }

  for (let i = 0; i < imageRefs.length; i++) {
    const img = imageRefs[i]!
    if (col === 0 && y < minYToStartRow) {
      startNewPhotoPage()
      x = MARGIN
      col = 0
    }

    const scale = Math.min(cellSize / img.width, cellSize / img.height, 1)
    const w = img.width * scale
    const h = img.height * scale
    const cellBottom = y - cellSize
    const ox = x + (cellSize - w) / 2
    const imgBottom = cellBottom + (cellSize - h) / 2

    pageRef.drawRectangle({
      x,
      y: cellBottom,
      width: cellSize,
      height: cellSize,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.88, 0.9, 0.93),
      borderWidth: 0.35,
    })
    pageRef.drawImage(img.embed, { x: ox, y: imgBottom, width: w, height: h })

    col++
    if (col >= imagesPerRow) {
      col = 0
      x = MARGIN
      y -= rowStep
    } else {
      x += cellSize + gap
    }
  }

  if (col !== 0) {
    y -= rowStep
  }

  return { page: pageRef, y: y - 16 }
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
    mergedTotalDoorsCustomerInfo,
    coverQrPngBytes,
  } = options
  const pdf = await PDFDocument.create()

  const roboto = await embedRobotoForPdfLib(pdf)
  let font: PDFFontType = roboto?.regular ?? (await pdf.embedFont(StandardFonts.Helvetica))
  let bold: PDFFontType = roboto?.bold ?? (await pdf.embedFont(StandardFonts.HelveticaBold))

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

  let qrCoverImage: PDFImageType | null = null
  if (coverQrPngBytes && coverQrPngBytes.length > 0) {
    try {
      qrCoverImage = await pdf.embedPng(coverQrPngBytes)
    } catch {
      qrCoverImage = null
    }
  }

  const contentStartY = PAGE_HEIGHT - HEADER_HEIGHT
  const contentTop = contentStartY

  // ----- Page 1: Digital report + client info + door diagram (no separate inspection / executive summary) -----
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  drawReportFirstPage(
    page,
    {
      clientName,
      locationName,
      form,
      logoImage,
      qrImage: qrCoverImage,
      doorDiagramImage,
      mergedTotalDoorsCustomerInfo,
    },
    font,
    bold,
  )

  // ----- Door sections -----
  const photoBytesByDoor = doorPhotoBytes ?? form.doors.map(() => [])

  let y = contentStartY
  for (let doorIndex = 0; doorIndex < form.doors.length; doorIndex++) {
    const door = form.doors[doorIndex]
    const needNewPage = true
    if (needNewPage) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      drawHeader(page, reportNumber, reportDate, logoImage, font, bold)
      y = contentStartY
    }

    const doorNumLabel = String(door.door_number ?? '').trim() || String(doorIndex + 1)
    const doorHeading = `Door ${doorNumLabel}`
    const doorTitleBaseline = y
    page.drawText(doorHeading, {
      x: MARGIN,
      y: doorTitleBaseline,
      size: 13,
      font: bold,
      color: SECTION_COLOR,
    })
    drawDoorStatusBadge(page, doorTitleBaseline, door, bold)
    y -= DOOR_TITLE_GAP
    const cyclesPdf = formatDoorCyclesPdf(door.door_cycles)
    const metaLine = `Door Type: ${door.door_type || '-'}  |  Cycles: ${cyclesPdf}  |  View Window Visibility: ${door.view_window_visibility}%`
    page.drawText(metaLine, {
      x: MARGIN,
      y,
      size: DOOR_META_SIZE,
      font,
      color: rgb(0.42, 0.44, 0.48),
    })
    y -= DOOR_META_SIZE + 4
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.6,
      color: rgb(0.72, 0.74, 0.78),
      dashArray: [3, 3],
    })
    y -= 10

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

    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    drawHeader(page, reportNumber, reportDate, logoImage, font, bold)
    y = contentStartY

    y = drawDoorNotes(page, door.notes, y, font, bold)

    if (imageRefs.length > 0) {
      y -= 14
      page.drawText('Uploaded Photos', { x: MARGIN, y, size: 12, font: bold, color: SECTION_COLOR })
      y -= 16
      const grid = drawImageGrid(page, y, imageRefs, 3, {
        pdf,
        reportNumber,
        reportDate,
        logoImage,
        font,
        bold,
        contentTop,
      })
      page = grid.page
      y = grid.y
    }
    y -= 20
  }

  // ----- Last page: same "Approval & Sign-off" layout as merged reports -----
  const signOffLogoBytes =
    logoBytes && logoBytes.length > 0 ? logoBytes : ((await loadNbeLogoBytes()) ?? null)

  const mergedSignOffBytes = await generateMergedReportSignaturePdf({
    logoBytes: signOffLogoBytes,
    technicianName: form.technician_name || '-',
    technicianSignatureBytes: signatureBytes ?? null,
    reportDateLabel: reportDate,
    signOff: {
      metrics: aggregateSignOffDisplayMetrics(form),
      findingGroups: buildSignOffFindingGroups(form),
    },
  })

  const sigDoc = await PDFDocument.load(mergedSignOffBytes)
  const sigPageCount = sigDoc.getPageCount()
  for (let i = 0; i < sigPageCount; i++) {
    const [copied] = await pdf.copyPages(sigDoc, [i])
    pdf.addPage(copied)
  }

  return savePdfBytes(pdf)
}
