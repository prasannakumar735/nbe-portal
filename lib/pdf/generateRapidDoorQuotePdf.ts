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
  doorType:          string
  doorTypeName:      string
  doorModel?:        string   // e.g. "PE 150"
  openingW:          string   // clear width
  openingH:          string   // clear height
  externalW?:        string   // computed external width
  externalH?:        string   // computed external height
  frameRaw?:         string   // raw code: GAL, P/C, S/S
  frame:             string   // mapped name: Galvanized, Powder Coated, Stainless Steel
  curtain:           string
  colour:            string
  motorKw?:          string
  motorSide:         string
  cbSide?:           string
  safetyLines:       string[]
  safetyByCategory?: Record<string, string>
  qty:               number
  unitPrice:         number
  installation:      number
  demolition:        number
  equipHire:         number
  accTravel:         number
  lineTotal:         number
  customDesc:        string | null
  colourCode:        string | null
  doorImagePath?:    string | null
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
  imageStyle?:      string
  // Legacy single-door fields
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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Page 1: Brochure-style door specification sheet ──────────────────────────

async function drawPage1(
  pdfDoc: PDFDocument,
  input: RapidDoorQuotePdfInput,
  door: DoorLineItem,
  doorIndex: number,
  totalDoors: number,
  grandTotal: number,
  fonts: { reg: PDFFont; bold: PDFFont; display: PDFFont },
  logoImg: Awaited<ReturnType<typeof PDFDocument.prototype.embedPng>> | null,
) {
  const { reg, bold, display } = fonts
  const page = pdfDoc.addPage([595.28, 841.89])
  const PW = 595.28
  const ML = 36, MR = 36, CW = PW - ML - MR
  let y = 800

  const d = door
  const doorRef = `DOOR D${String(doorIndex + 1).padStart(2, '0')}`

  // ── HEADER ────────────────────────────────────────────────────────────────
  const logoH = 44
  if (logoImg) {
    const { width: lw, height: lh } = logoImg
    page.drawImage(logoImg, { x: ML, y: y - logoH, width: (lw / lh) * logoH, height: logoH })
  } else {
    t(page, 'NBE',       ML, y - 22, bold, 26, BLACK)
    t(page, 'australia', ML, y - 40, bold, 15, BRAND)
  }
  t(page, 'ABN: 17 007 048 008', ML, y - logoH - 8, reg, 8, GREY)

  // "QUOTE" right-aligned
  t(page, 'QUOTE', PW - MR - display.widthOfTextAtSize('QUOTE', 32), y - 28, display, 32, BLACK)

  // Subtitle: INDUSTRIAL RAPID DOOR (RAPID in bold)
  const s1 = 'INDUSTRIAL ', s2 = 'RAPID', s3 = ' DOOR'
  const subSz = 11
  const subX = PW - MR - reg.widthOfTextAtSize(s1, subSz) - bold.widthOfTextAtSize(s2, subSz) - reg.widthOfTextAtSize(s3, subSz)
  t(page, s1, subX,                                              y - 50, reg,  subSz, DARK)
  t(page, s2, subX + reg.widthOfTextAtSize(s1, subSz),          y - 50, bold, subSz, DARK)
  t(page, s3, subX + reg.widthOfTextAtSize(s1, subSz) + bold.widthOfTextAtSize(s2, subSz), y - 50, reg, subSz, DARK)

  y -= logoH + 16

  // Brand purple rule
  page.drawLine({ start: { x: ML, y }, end: { x: PW - MR, y }, thickness: 2, color: BRAND })
  y -= 18

  // ── DOOR IDENTIFIER ───────────────────────────────────────────────────────
  t(page, doorRef, ML, y, bold, 16, BRAND)
  y -= 22

  const doorTitle = `${d.doorType}  |  ${d.doorTypeName.toUpperCase()}`
  t(page, doorTitle, ML, y, bold, 14, DARK)
  y -= 20

  t(page, `Opening: ${d.openingW} W × ${d.openingH} H mm   |   Quantity: ${d.qty}`, ML, y, reg, 10, DARK)
  y -= 18

  // ── TWO-COLUMN BODY ───────────────────────────────────────────────────────
  const leftColW  = Math.floor(CW * 0.49)
  const rightColX = ML + leftColW + 10
  const rightColW = CW - leftColW - 10
  const twoColTopY = y

  // ─ LEFT: DOOR SPECIFICATION TABLE ────────────────────────────────────────
  page.drawRectangle({ x: ML, y: y - 20, width: leftColW, height: 20, color: rgb(0.18, 0.18, 0.44) })
  t(page, 'DOOR SPECIFICATION', ML + 8, y - 14, bold, 9, WHITE)
  y -= 20

  const isPresent = (v: string | undefined) => !!v && v !== '-'

  const motorSideLabel = (() => {
    const ms = (d.motorSide ?? '').toUpperCase()
    if (ms === 'RHD') return 'Right Hand Drive (RHD)'
    if (ms === 'LHD') return 'Left Hand Drive (LHD)'
    return d.motorSide || ''
  })()

  const specRows: [string, string][] = [
    ['Door Reference',               doorRef],
    ['Model',                        `${d.doorType} – ${d.doorTypeName}`],
    ['Opening Size (Clear)',          `${d.openingW} W × ${d.openingH} H mm`],
    ...(d.externalW ? [['External Size', `${d.externalW} W × ${d.externalH} H mm`] as [string,string]] : []),
    ['Frame',                        d.frame],
    ['Curtain',                      d.curtain],
    ...(d.colour ? [['Curtain Colour', d.colour] as [string,string]] : []),
    ['Safety Edge',                  'Soft'],
    ...(d.motorKw ? [['Motor', `${d.motorKw} kW`] as [string,string]] : []),
    ...(motorSideLabel ? [['Motor Side', motorSideLabel] as [string,string]] : []),
    ...(isPresent(d.safetyByCategory?.safety) ? [['Control Box', d.safetyByCategory!.safety] as [string,string]] : []),
    ['Hazard Lamp',                  'Included'],
    ['Activation – Push Button',        isPresent(d.safetyByCategory?.pushButton)    ? 'Included' : 'Excluded'],
    ['Activation – Radar',              isPresent(d.safetyByCategory?.radar)          ? 'Included' : 'Excluded'],
    ['Activation – Remote Control',     isPresent(d.safetyByCategory?.remoteControl)  ? 'Included' : 'Excluded'],
    ['Activation – Induction Loop',     isPresent(d.safetyByCategory?.inductLoop)     ? 'Included' : 'Excluded'],
    ['Activation – Contactless Exit',   isPresent(d.safetyByCategory?.swipe)          ? 'Included' : 'Excluded'],
  ]

  const SPEC_ROW_H = 18
  const labelX  = ML + 6
  const valueX  = ML + leftColW * 0.50

  specRows.forEach(([label, value], i) => {
    const rowY = y - i * SPEC_ROW_H
    if (i % 2 === 0) {
      page.drawRectangle({ x: ML, y: rowY - SPEC_ROW_H, width: leftColW, height: SPEC_ROW_H, color: rgb(0.96, 0.96, 0.98) })
    }
    t(page, label, labelX, rowY - 12, bold, 7.5, DARK)
    const isExcl = value === 'Excluded'
    t(page, value, valueX, rowY - 12, reg, 8, isExcl ? GREY : DARK)
  })

  // Bottom border
  const specBottom = y - specRows.length * SPEC_ROW_H
  page.drawLine({ start: { x: ML, y: specBottom }, end: { x: ML + leftColW, y: specBottom }, thickness: 0.5, color: rgb(0.78, 0.78, 0.85) })

  // ─ RIGHT: IMAGE + KEY FEATURES + PRICE ───────────────────────────────────
  let ry = twoColTopY

  // Door image
  let actualImgH = 0
  if (d.doorImagePath) {
    try {
      const imgBytes = await readFile(d.doorImagePath)
      const doorImg  = await pdfDoc.embedPng(imgBytes)
      const { width: dw, height: dh } = doorImg
      const maxW = rightColW, maxH = 218
      let drawW = maxW, drawH = (dh / dw) * drawW
      if (drawH > maxH) { drawH = maxH; drawW = (dw / dh) * drawH }
      page.drawImage(doorImg, {
        x: rightColX + (rightColW - drawW) / 2,
        y: ry - drawH,
        width: drawW, height: drawH,
      })
      actualImgH = drawH
    } catch { /* no image */ }
  }
  ry -= actualImgH + 4

  // "Indicative image" caption
  t(page, 'Indicative image', rightColX, ry, reg, 7.5, GREY)
  ry -= 20

  // KEY FEATURES heading + rule
  t(page, 'KEY FEATURES', rightColX, ry, bold, 11, BRAND)
  ry -= 14
  page.drawLine({ start: { x: rightColX, y: ry }, end: { x: rightColX + rightColW, y: ry }, thickness: 0.5, color: BRAND })
  ry -= 14

  // Feature rows
  const includedControls = [
    isPresent(d.safetyByCategory?.pushButton)   ? 'push button' : '',
    isPresent(d.safetyByCategory?.radar)         ? 'radar' : '',
    isPresent(d.safetyByCategory?.remoteControl) ? 'remote control' : '',
  ].filter(Boolean)
  const controlsDesc = includedControls.length > 0 ? includedControls.join(', ') : 'Standard controls'

  const features: [string, string][] = [
    ['High speed operation',     d.motorKw ? `${d.motorKw} kW variable frequency drive` : 'Variable frequency drive'],
    ['Robust and reliable',      `${d.frame} frame with ${d.curtain} curtain`],
    ['Enhanced safety',          'Soft safety edge and hazard lamp included'],
    ['Flexible control options', controlsDesc],
  ]

  const FEAT_ROW_H = 34
  const ICON_SZ    = 18
  const ICON_GAP   = 10

  features.forEach(([title, desc], i) => {
    const fY = ry - i * FEAT_ROW_H
    // Icon: brand-purple square
    page.drawRectangle({ x: rightColX, y: fY - ICON_SZ, width: ICON_SZ, height: ICON_SZ, color: BRAND })
    // Simple white mark inside icon
    const marks = ['>', '+', 'o', '=']
    page.drawText(marks[i] ?? '-', { x: rightColX + 4, y: fY - ICON_SZ + 5, size: 9, font: bold, color: WHITE })
    const tx = rightColX + ICON_SZ + ICON_GAP
    t(page, title, tx, fY - 10, bold, 9, DARK)
    t(page, desc,  tx, fY - 21, reg,  7.5, GREY)
  })

  ry -= features.length * FEAT_ROW_H + 14

  // ── PRICE BOX ─────────────────────────────────────────────────────────────
  const priceH = 46
  page.drawRectangle({ x: rightColX, y: ry - priceH, width: rightColW, height: priceH, color: rgb(0.95, 0.95, 0.97) })
  page.drawLine({ start: { x: rightColX, y: ry },        end: { x: rightColX + rightColW, y: ry },        thickness: 0.5, color: rgb(0.78, 0.78, 0.85) })
  page.drawLine({ start: { x: rightColX, y: ry - priceH }, end: { x: rightColX + rightColW, y: ry - priceH }, thickness: 0.5, color: rgb(0.78, 0.78, 0.85) })
  t(page, `${doorRef} PRICE`, rightColX + 8, ry - 14, bold, 10, DARK)
  tRight(page, fmtAUD(d.unitPrice), rightColX + rightColW - 8, ry - 12, bold, 14, DARK)
  t(page, '(ex. GST)', rightColX + rightColW - 8 - reg.widthOfTextAtSize('(ex. GST)', 8), ry - 30, reg, 8, GREY)

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = 48
  page.drawLine({ start: { x: ML, y: footerY + 14 }, end: { x: PW - MR, y: footerY + 14 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) })
  t(page, 'NBE AUSTRALIA',       ML, footerY,      bold, 8,   DARK)
  t(page, 'nbeaustralia.com.au', ML, footerY - 10, reg,  7.5, GREY)
  const pageNum = totalDoors > 1 ? `${doorRef}  |  Page ${doorIndex + 1} of ${totalDoors + 1}` : `Page 1 of 2`
  tRight(page, `Quote No. ${input.quoteNumber}  |  ${pageNum}`, PW - MR, footerY, reg, 8, GREY)
}

// ── Page 2: Summary (existing layout) ────────────────────────────────────────

async function drawPage2(
  pdfDoc: PDFDocument,
  input: RapidDoorQuotePdfInput,
  doors: DoorLineItem[],
  grandTotal: number,
  fonts: { reg: PDFFont; bold: PDFFont; display: PDFFont },
  logoImg: Awaited<ReturnType<typeof PDFDocument.prototype.embedPng>> | null,
) {
  const { reg, bold, display } = fonts
  const page = pdfDoc.addPage([595.28, 841.89])
  const PW = 595.28
  const ML = 36, MR = 36, CW = PW - ML - MR
  let y = 800

  const totalQty   = doors.reduce((s, d) => s + d.qty, 0)
  const hasInstall = doors.some(d => (d.installation ?? 0) > 0)

  // ── HEADER ────────────────────────────────────────────────────────────────
  const logoH = 50
  if (logoImg) {
    const { width: lw, height: lh } = logoImg
    page.drawImage(logoImg, { x: ML, y: y - logoH, width: (lw / lh) * logoH, height: logoH })
  } else {
    t(page, 'NBE',       ML, y - 22, bold, 26, BLACK)
    t(page, 'australia', ML, y - 44, bold, 15, BRAND)
  }
  t(page, 'ABN: 17 007 048 008', ML, y - logoH - 10, reg, 9, DARK)

  t(page, 'QUOTE', PW - MR - display.widthOfTextAtSize('QUOTE', 34), y - 26, display, 34, BLACK)

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

  const dateLabelX = ML + CW - 130
  const dateRows: [string, string][] = [
    ['DATE',        input.date],
    ['VALID UNTIL', input.validUntil],
    ['QUOTE NO.',   input.quoteNumber],
  ]
  dateRows.forEach(([label, val], i) => {
    t(page,      label, dateLabelX,  y - i * 14, bold, 8.5, DARK)
    tRight(page, val,   ML + CW,     y - i * 14, reg,  8.5, DARK)
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

  for (let di = 0; di < doors.length; di++) {
    const d = doors[di]
    if (di > 0) drawHLine(page, ML, y, CW, 0.5, rgb(0.55, 0.55, 0.55))
    let descLines: string[]
    if (d.customDesc) {
      descLines = d.customDesc.split('\n').map(l => l.trim()).filter(Boolean)
    } else {
      const dl1 = `${d.doorType} | ${d.doorTypeName}`
      const dl2 = `${d.openingW} W × ${d.openingH} H mm`
      const dl3 = `${d.frame} frame | ${d.curtain} | ${d.colour} | ${d.motorSide}`
      const dl4 = (d.safetyLines?.length ?? 0) > 0 ? `CONTROLS: ${d.safetyLines.join(' | ')}` : ''
      descLines = [dl1, dl2, dl3, dl4].filter(Boolean)
    }
    const rowH = descLines.length * 11 + 10

    t(page, String(di + 1), cNo + 2, y - 11, reg, 8.5, DARK)
    t(page, d.doorType,     cItem,   y - 11, reg, 8.5, DARK)
    descLines.forEach((ln, i) => t(page, ln, cDesc, y - 11 - i * 11, reg, 8, DARK))
    tCenter(page, String(d.qty),               cQtyX, cQtyW, y - 11, reg, 8.5, DARK)
    tRight(page,  fmtAUD(d.unitPrice),         cUpRight,     y - 11, reg, 8.5, DARK)
    tRight(page,  fmtAUD(d.qty * d.unitPrice), cTotRight,    y - 11, bold, 8.5, DARK)
    y -= rowH
  }

  const firstRowH = (() => {
    const d = doors[0]
    const lines = [1, 1, 1, d.safetyLines.length > 0 ? 1 : 0].filter(Boolean).length
    return lines * 11 + 10
  })()
  const emptyRowH = Math.max(Math.round(firstRowH * 0.7), 28)
  const emptyCount = Math.max(0, 4 - (doors.length - 1))
  for (let i = 0; i < emptyCount; i++) {
    drawHLine(page, ML, y, CW, 0.3, rgb(0.85, 0.85, 0.85))
    y -= emptyRowH
  }
  y -= 10

  // ── ADDITIONAL COSTS ─────────────────────────────────────────────────────
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

  // ── BANK DETAILS + TOTALS ─────────────────────────────────────────────────
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
    page.drawText(ln, { x: ML, y: footerStartY - i * footerLineH, size: footerSize, font: reg, color: DARK })
  })
}

// ── Entry point ───────────────────────────────────────────────────────────────

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
        motorKw:      input.motorKw      ?? '',
        motorSide:    input.motorSide    ?? '',
        cbSide:       input.cbSide       ?? '',
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

  const pdfDoc = await PDFDocument.create()

  // Embed fonts once, share across pages
  const roboto    = await embedRobotoForPdfLib(pdfDoc)
  const jostLight = await embedDisplayFont(pdfDoc)
  const reg:     PDFFont = roboto?.regular ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))
  const bold:    PDFFont = roboto?.bold    ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
  const display: PDFFont = jostLight ?? reg

  // Embed logo once
  let logoImg: Awaited<ReturnType<typeof PDFDocument.prototype.embedPng>> | null = null
  try {
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'NBE_LOGO_BK_PL.png'))
    logoImg = await pdfDoc.embedPng(logoBytes)
  } catch { /* use text fallback */ }

  const fonts = { reg, bold, display }

  // One page-1 per door (reference layout)
  for (let i = 0; i < doors.length; i++) {
    await drawPage1(pdfDoc, input, doors[i], i, doors.length, grandTotal, fonts, logoImg)
  }

  // Final page — summary of all doors
  await drawPage2(pdfDoc, input, doors, grandTotal, fonts, logoImg)

  return pdfDoc.save()
}
