import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'

const BRAND = rgb(0.282, 0.067, 0.749)   // #4811BF
const DARK  = rgb(0.08,  0.08,  0.08)
const GREY  = rgb(0.40,  0.40,  0.40)
const WHITE = rgb(1,     1,     1)
const BLACK = rgb(0,     0,     0)

export type DoorLineItem = {
  doorType:     string
  doorTypeName: string
  openingW:     string
  openingH:     string
  frame:        string
  curtain:      string
  colour:       string
  motorSide:    string
  safetyLines:  string[]
  qty:          number
  unitPrice:    number
  installation: number
  demolition:   number
  equipHire:    number
  accTravel:    number
  lineTotal:    number
  customDesc:   string | null
  colourCode:   string | null
  doorImagePath?: string | null
}

export type RapidDoorQuotePdfInput = {
  quoteNumber:      string
  date:             string
  validUntil:       string
  grandTotal:       number
  doors:            DoorLineItem[]
  customerName:     string
  customerAttn:     string
  customerAddress:  string
  customerPostcode: string
  customerPhone:    string
  customerEmail:    string
  // Legacy single-door fields (kept for backwards compat)
  doorType?:         string
  doorTypeName?:     string
  openingW?:         string
  openingH?:         string
  frame?:            string
  curtain?:          string
  colour?:           string
  motorKw?:          string
  motorSide?:        string
  cbSide?:           string
  safetyLines?:      string[]
  qty?:              number
  unitPrice?:        number
  installation?:     number
  demolition?:       number
  equipHire?:        number
  accTravel?:        number
  lineTotal?:        number
  doorImagePath?:    string | null
}

async function embedDisplayFont(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  try {
    return await pdfDoc.embedFont(
      await readFile(path.join(process.cwd(), 'public', 'fonts', 'Jost-Light.ttf')),
      { subset: true },
    )
  } catch { return null }
}

function drawHLine(page: PDFPage, x: number, y: number, w: number, thickness = 0.5, color = rgb(0.75, 0.75, 0.75)) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color })
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color = rgb(0.93, 0.93, 0.93)) {
  page.drawRectangle({ x, y, width: w, height: h, color })
}

function t(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 9, color = DARK) {
  if (!text) return
  page.drawText(text, { x, y, size, font, color })
}

function tRight(page: PDFPage, text: string, xRight: number, y: number, font: PDFFont, size = 9, color = DARK) {
  if (!text) return
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color })
}

function tCenter(page: PDFPage, text: string, xLeft: number, colW: number, y: number, font: PDFFont, size = 9, color = DARK) {
  if (!text) return
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: xLeft + (colW - w) / 2, y, size, font, color })
}

function fmtAUD(n: number) {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function generateRapidDoorQuotePdf(input: RapidDoorQuotePdfInput): Promise<Uint8Array> {
  // Normalise: support new multi-door `doors[]` and legacy single-door fields
  const doors: DoorLineItem[] = input.doors?.length
    ? input.doors
    : [{
        doorType:     input.doorType     ?? '',
        doorTypeName: input.doorTypeName ?? '',
        openingW:     input.openingW     ?? '',
        openingH:     input.openingH     ?? '',
        frame:        input.frame        ?? '',
        curtain:      input.curtain      ?? '',
        colour:       input.colour       ?? '',
        motorSide:    input.motorSide    ?? '',
        safetyLines:  input.safetyLines  ?? [],
        qty:          input.qty          ?? 1,
        unitPrice:    input.unitPrice    ?? 0,
        installation: input.installation ?? 0,
        demolition:   input.demolition   ?? 0,
        equipHire:    input.equipHire    ?? 0,
        accTravel:    input.accTravel    ?? 0,
        lineTotal:    input.lineTotal    ?? 0,
        customDesc:   null,
        colourCode:   null,
        doorImagePath: input.doorImagePath,
      }]

  const grandTotal = input.grandTotal ?? doors.reduce((s, d) => s + d.lineTotal, 0)
  const totalQty   = doors.reduce((s, d) => s + d.qty, 0)
  const hasInstall = doors.some(d => (d.installation ?? 0) > 0)

  const pdfDoc = await PDFDocument.create()
  const page   = pdfDoc.addPage([595.28, 841.89])
  const { width: PW } = page.getSize()

  const roboto    = await embedRobotoForPdfLib(pdfDoc)
  const jostLight = await embedDisplayFont(pdfDoc)
  const reg:     PDFFont = roboto?.regular ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))
  const bold:    PDFFont = roboto?.bold    ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
  const display: PDFFont = jostLight ?? reg

  const ML = 36
  const MR = 36
  const CW = PW - ML - MR
  let y = 800

  // ── HEADER ───────────────────────────────────────────────────────────────
  const logoH = 50
  try {
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'NBE_LOGO_BK_PL.png'))
    const logoImg   = await pdfDoc.embedPng(logoBytes)
    const { width: lw, height: lh } = logoImg
    page.drawImage(logoImg, { x: ML, y: y - logoH, width: (lw / lh) * logoH, height: logoH })
  } catch {
    t(page, 'NBE', ML, y - 22, bold, 26, BLACK)
    t(page, 'australia', ML, y - 44, bold, 15, BRAND)
  }
  // ABN — black, small gap below logo bottom
  t(page, 'ABN: 17 007 048 008', ML, y - logoH - 10, reg, 9, DARK)

  // "QUOTE" — cap top aligned with logo top: for 34pt font cap-height ≈ 24pt, so baseline at y-26
  t(page, 'QUOTE', PW - MR - display.widthOfTextAtSize('QUOTE', 34), y - 26, display, 34, BLACK)

  // Subtitle — 8pt below QUOTE baseline (34pt baseline at y-26, subtitle at y-26-14 = y-40)
  const subtitle = 'INDUSTRIAL RAPID DOOR  |  SUMMARY'
  t(page, subtitle, PW - MR - bold.widthOfTextAtSize(subtitle, 13), y - 52, bold, 13, BRAND)

  y -= logoH + 22
  drawHLine(page, ML, y, CW, 1, DARK)
  y -= 20

  // ── COMPANY INFO + DATE BLOCK ─────────────────────────────────────────────
  t(page, 'NBE AUSTRALIA',                                      ML, y,      bold, 8.5, DARK)
  t(page, '22A Humeside Dr, Campbellfield VIC 3061, Australia', ML, y - 12, reg,  8,   DARK)
  t(page, 'accountsreceivable@nbeaustralia.com.au',             ML, y - 24, reg,  8,   DARK)
  t(page, 'www.nbeaustralia.com.au',                            ML, y - 36, reg,  8,   DARK)

  // Date block: labels bold left-aligned, values right-aligned to right margin
  const dateLabelX = ML + CW - 130
  const dateRows: [string, string][] = [
    ['DATE',        input.date],
    ['VALID UNTIL', input.validUntil],
    ['QUOTE NO.',   input.quoteNumber],
  ]
  dateRows.forEach(([label, val], i) => {
    t(page,      label, dateLabelX,    y - i * 14, bold, 8.5, DARK)
    tRight(page, val,   ML + CW,       y - i * 14, reg,  8.5, DARK)
  })

  y -= 56

  // ── CUSTOMER | QUOTE SUMMARY ──────────────────────────────────────────────
  const STRIP_H = 20
  drawRect(page, ML, y - STRIP_H, CW, STRIP_H, BLACK)
  const half = CW / 2
  page.drawLine({ start: { x: ML + half, y }, end: { x: ML + half, y: y - STRIP_H }, thickness: 0.5, color: rgb(0.35, 0.35, 0.35) })
  t(page, 'CUSTOMER',      ML + 8,        y - 13, bold, 9, WHITE)
  t(page, 'QUOTE SUMMARY', ML + half + 8, y - 13, bold, 9, WHITE)
  y -= STRIP_H + 20

  const cLX = ML + 8;  const cVX = ML + 68
  const sLX = ML + half + 8;  const sVX = ML + half + 90
  const custRows: [string, string][] = [
    ['Customer',  input.customerName     || '—'],
    ['Attention', input.customerAttn     || '—'],
    ['Address',   input.customerAddress  || '—'],
    ['Postcode',  input.customerPostcode || '—'],
    ['Phone',     input.customerPhone    || '—'],
    ['Email',     input.customerEmail    || '—'],
  ]
  const summaryRows: [string, string][] = [
    ['Product',         'Industrial Rapid Doors'],
    ['Number of Types', String(doors.length)],
    ['Total Quantity',  String(totalQty)],
    ['Delivery',        'Included'],
    ['Installation',    hasInstall ? 'Included' : 'Excluded'],
  ]
  const sy = y
  custRows.forEach(([label, val], i) => {
    t(page, label, cLX, y - i * 13, bold, 8, DARK)
    t(page, val,   cVX, y - i * 13, reg,  8, DARK)
  })
  summaryRows.forEach(([label, val], i) => {
    t(page, label, sLX, sy - i * 13, bold, 8, DARK)
    t(page, val,   sVX, sy - i * 13, reg,  8, DARK)
  })
  y -= Math.max(custRows.length, summaryRows.length) * 13 + 16

  // ── LINE ITEMS TABLE ──────────────────────────────────────────────────────
  const cNo = ML;  const cItem = ML + 22;  const cDesc = ML + 60
  const cQtyW = 35;  const cQtyX = ML + CW - 165
  const cUpRight = ML + CW - 65;  const cTotRight = ML + CW

  const TH = 20
  drawRect(page, ML, y - TH, CW, TH, BLACK)
  t(page, 'NO',          cNo + 2,  y - 14, bold, 9, WHITE)
  t(page, 'ITEM',        cItem,    y - 14, bold, 9, WHITE)
  t(page, 'DESCRIPTION', cDesc,    y - 14, bold, 9, WHITE)
  tCenter(page, 'QTY',        cQtyX, cQtyW, y - 14, bold, 9, WHITE)
  tRight(page,  'UNIT PRICE', cUpRight,     y - 14, bold, 9, WHITE)
  tRight(page,  'TOTAL',      cTotRight,    y - 14, bold, 9, WHITE)
  y -= TH + 4

  // Door rows (one per door in the array)
  for (let di = 0; di < doors.length; di++) {
    const d = doors[di]
    // Separator between doors (not before the first row)
    if (di > 0) drawHLine(page, ML, y, CW, 0.5, rgb(0.55, 0.55, 0.55))
    let descLines: string[]
    if (d.customDesc) {
      // User-edited description: use every non-empty line as-is
      descLines = d.customDesc.split('\n').map(l => l.trim()).filter(Boolean)
    } else {
      const dl1 = `${d.doorType} | ${d.doorTypeName}`
      const dl2 = `${d.openingW} W × ${d.openingH} H mm`
      const dl3 = `${d.frame} frame | ${d.curtain} | ${d.colour} | ${d.motorSide}`
      const dl4 = (d.safetyLines?.length ?? 0) > 0 ? `CONTROLS: ${d.safetyLines.join(' | ')}` : ''
      descLines = [dl1, dl2, dl3, dl4].filter(Boolean)
    }
    const rowH = descLines.length * 11 + 10

    t(page, String(di + 1), cNo + 2,   y - 11, reg, 8.5, DARK)
    t(page, d.doorType,     cItem,     y - 11, reg, 8.5, DARK)
    descLines.forEach((ln, i) => t(page, ln, cDesc, y - 11 - i * 11, reg, 8, DARK))
    tCenter(page, String(d.qty),               cQtyX, cQtyW, y - 11, reg, 8.5, DARK)
    tRight(page,  fmtAUD(d.unitPrice),         cUpRight,     y - 11, reg, 8.5, DARK)
    tRight(page,  fmtAUD(d.qty * d.unitPrice), cTotRight,    y - 11, bold, 8.5, DARK)
    y -= rowH
  }

  // Empty filler rows
  const firstRowH = (() => {
    const d = doors[0]
    const lines = [1,1,1, d.safetyLines.length > 0 ? 1 : 0].filter(Boolean).length
    return lines * 11 + 10
  })()
  const emptyRowH = Math.max(Math.round(firstRowH * 0.7), 28)
  const emptyCount = Math.max(0, 4 - (doors.length - 1))
  for (let i = 0; i < emptyCount; i++) {
    drawHLine(page, ML, y, CW, 0.3, rgb(0.85, 0.85, 0.85))
    y -= emptyRowH
  }

  y -= 10

  // ── ADDITIONAL COSTS (aggregated across all doors) ────────────────────────
  const totalInstall = doors.reduce((s, d) => s + d.installation, 0)
  const totalDemol   = doors.reduce((s, d) => s + d.demolition, 0)
  const totalEquip   = doors.reduce((s, d) => s + d.equipHire, 0)
  const totalTravel  = doors.reduce((s, d) => s + d.accTravel, 0)

  const addlRows: [string, number][] = [
    ['Installation',           totalInstall],
    ['Demolition',             totalDemol],
    ['Equipment Hire',         totalEquip],
    ['Accommodation & Travel', totalTravel],
  ]
  const addlRowH = 18
  addlRows.forEach(([label, amount], i) => {
    drawHLine(page, ML, y, CW, 0.6, rgb(0.65, 0.65, 0.65))
    t(page, label,                                         cDesc,     y - 12, reg, 9, DARK)
    tCenter(page, amount > 0 ? '1' : '-',                 cQtyX, cQtyW, y - 12, reg, 9, DARK)
    tRight(page, amount > 0 ? fmtAUD(amount) : '(excl.)', cUpRight,  y - 12, reg, 9, DARK)
    tRight(page, amount > 0 ? fmtAUD(amount) : '-',       cTotRight, y - 12, reg, 9, DARK)
    if (i === addlRows.length - 1) drawHLine(page, ML, y - addlRowH, CW, 0.6, rgb(0.65, 0.65, 0.65))
    y -= addlRowH
  })

  y -= 24

  // ── BANK DETAILS + TOTALS ────────────────────────────────────────────────
  const bankY = y
  t(page, 'BANK DETAILS',                             ML, bankY,      bold, 8.5, DARK)
  t(page, 'Account Name: NBE Australia Pty Ltd',      ML, bankY - 14, reg,  8,   DARK)
  t(page, 'BSB: 013-525  |  Account No.: 3473-93755', ML, bankY - 26, reg,  8,   DARK)

  const totLabelRight = ML + CW - 70
  const totValRight   = ML + CW

  tRight(page, 'Subtotal',         totLabelRight, bankY,      bold, 10, DARK)
  tRight(page, fmtAUD(grandTotal), totValRight,   bankY,      reg,  10, DARK)

  tRight(page, 'GST (10%)',              totLabelRight, bankY - 22, bold, 10, DARK)
  tRight(page, fmtAUD(grandTotal * 0.1), totValRight,  bankY - 22, reg,  10, DARK)

  drawHLine(page, ML + CW - 170, bankY - 32, 170, 0.5)

  const totBoxW = 170
  const totBoxY = bankY - 56
  drawRect(page, ML + CW - totBoxW, totBoxY, totBoxW, 22, BLACK)
  t(page,      'TOTAL',                  ML + CW - totBoxW + 8, totBoxY + 6, bold, 11, WHITE)
  tRight(page, fmtAUD(grandTotal * 1.1), ML + CW,               totBoxY + 6, bold, 11, WHITE)

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const terms = "Subject to NBE Australia's standard Terms & Conditions. Final dimensions, site conditions and access must be confirmed prior to manufacture. Delivery, equipment hire and installation are excluded unless shown as priced line items. Electrical works are limited to connections between the control panel and door equipment. Power supply and isolator shall be provided by others."
  const footerSize = 8.5
  const footerLineH = 11
  const footerLines = wrapText(terms, reg, footerSize, CW)
  const footerStartY = 80
  footerLines.forEach((ln, i) => {
    t(page, ln, ML, footerStartY - i * footerLineH, reg, footerSize, DARK)
  })

  return pdfDoc.save()
}
