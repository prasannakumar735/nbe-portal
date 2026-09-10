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
  imageStyle?:        string
  page1Disclaimer?:   string
  page2SummaryNote?:  string
  endUser?:           'CUSTOMER' | 'DISTRIBUTOR' | 'TENDER'
  includeSummary?:         boolean   // default true — set false to skip page 2 and show extras on page 1
  customDoorImageBase64?:  string    // data URL (data:image/...;base64,...) — overrides doorImagePath on all doors
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

// ── Page 1: Customer-facing quote (reference style) ───────────────────────────

async function drawPage1(
  pdfDoc: PDFDocument,
  input: RapidDoorQuotePdfInput,
  door: DoorLineItem,
  doorIndex: number,
  totalDoors: number,
  grandTotal: number,
  fonts: { reg: PDFFont; bold: PDFFont; display: PDFFont },
  logoImg: Awaited<ReturnType<typeof PDFDocument.prototype.embedPng>> | null,
  allDoors: DoorLineItem[],
  includeSummary: boolean,
) {
  const { reg, bold, display } = fonts
  const page = pdfDoc.addPage([595.28, 841.89])
  const PW = 595.28
  const ML = 36, MR = 36, CW = PW - ML - MR
  let y = 800

  // For multi-door, each page shows only that door's detail
  const doors = [door]
  const firstDoor = door

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

  // "QUOTE" large
  t(page, 'QUOTE', PW - MR - display.widthOfTextAtSize('QUOTE', 38), y - 24, display, 38, BLACK)

  // Subtitle: INDUSTRIAL RAPID DOOR | PE01  (+ Door X of N for multi-door)
  const doorLabel = totalDoors > 1 ? `  (Door ${doorIndex + 1} of ${totalDoors})` : ''
  const subtitle = `INDUSTRIAL RAPID DOOR  |  ${firstDoor.doorType}${doorLabel}`
  t(page, subtitle, PW - MR - bold.widthOfTextAtSize(subtitle, 14), y - 58, bold, 14, BRAND)

  y -= logoH + 22
  drawHLine(page, ML, y, CW, 2.5, DARK)
  y -= 24

  // ── COMPANY INFO + DATE BLOCK ─────────────────────────────────────────────
  t(page, 'NBE AUSTRALIA',                                      ML, y,      bold, 8.5, DARK)
  t(page, '22A Humeside Dr, Campbellfield VIC 3061, Australia', ML, y - 12, reg,  8,   DARK)
  t(page, 'accountsreceivable@nbeaustralia.com.au',             ML, y - 24, reg,  8,   DARK)
  t(page, 'www.nbeaustralia.com.au',                            ML, y - 36, reg,  8,   DARK)

  const dateLabelX = ML + CW - 130
  const dateRows: [string, string][] = [
    ['DATE',        input.date],
    ['VALID UNTIL', input.validUntil],
  ]
  dateRows.forEach(([label, val], i) => {
    t(page,      label, dateLabelX,  y - i * 14, bold, 8.5, DARK)
    tRight(page, val,   ML + CW,     y - i * 14, reg,  8.5, DARK)
  })
  y -= 44

  // ── CUSTOMER DETAILS (left) + DOOR IMAGE (right) ──────────────────────────
  const custLabelX = ML + 8
  const custValueX = ML + 58   // tighter: label→value gap reduced
  const custRows: [string, string][] = [
    ['Customer',  input.customerName     || '—'],
    ['Attention', input.customerAttn     || '—'],
    ['Address',   input.customerAddress  || '—'],
    ['Location',  input.customerPostcode || '—'],
    ['Phone',     input.customerPhone    || '—'],
    ['Email',     input.customerEmail    || '—'],
  ]
  const STRIP_H = 18
  const custBlockW = 160       // label+value text block width
  const imgColX = ML + custBlockW + 8
  const imgColW = CW - custBlockW - 8
  const rowSpacing = 12
  // Image top starts above the CUSTOMER bar
  const imgTopOffset = 22   // how far above the bar the image extends
  const imgMaxH = 180
  const custSectionH = custRows.length * rowSpacing + 14

  // Pre-compute image dimensions so section height can expand if needed
  let imgDrawW = 0, imgDrawH = 0
  let loadedDoorImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    let imgBytes: Uint8Array | null = null
    let isJpeg = false
    if (input.customDoorImageBase64) {
      // Strip data URL prefix: "data:image/jpeg;base64,..." or "data:image/png;base64,..."
      const commaIdx = input.customDoorImageBase64.indexOf(',')
      if (commaIdx !== -1) {
        const header = input.customDoorImageBase64.slice(0, commaIdx)
        imgBytes = Buffer.from(input.customDoorImageBase64.slice(commaIdx + 1), 'base64')
        isJpeg = header.includes('jpeg') || header.includes('jpg')
      }
    } else if (firstDoor.doorImagePath) {
      imgBytes = await readFile(firstDoor.doorImagePath)
    }
    if (imgBytes) {
      try {
        loadedDoorImg = isJpeg
          ? await pdfDoc.embedJpg(imgBytes)
          : await pdfDoc.embedPng(imgBytes)
      } catch {
        // Fallback: try the other codec (e.g. JPEG mis-detected as PNG)
        try { loadedDoorImg = isJpeg ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes) } catch { /* give up */ }
      }
      if (loadedDoorImg) {
        const { width: dw, height: dh } = loadedDoorImg
        const maxW = imgColW - 8
        imgDrawW = maxW
        imgDrawH = (dh / dw) * imgDrawW
        if (imgDrawH > imgMaxH) { imgDrawH = imgMaxH; imgDrawW = (dw / dh) * imgDrawH }
      }
    }
  } catch { /* no image */ }

  // sectionH must cover image bottom (image extends below bar by imgDrawH - STRIP_H - imgTopOffset)
  const imgOverhang = Math.max(0, imgDrawH - STRIP_H - imgTopOffset)
  const sectionH = Math.max(custSectionH, imgOverhang + 8)

  // ── CUSTOMER HEADER BAR (width = label+value content width) ──────────────
  drawRect(page, ML, y - STRIP_H, custBlockW, STRIP_H, BLACK)
  t(page, 'CUSTOMER', ML + 8, y - 12, bold, 9, WHITE)
  y -= STRIP_H

  custRows.forEach(([label, val], i) => {
    t(page, label, custLabelX, y - 12 - i * rowSpacing, bold, 8, DARK)
    t(page, val,   custValueX, y - 12 - i * rowSpacing, reg,  8, DARK)
  })

  if (loadedDoorImg && imgDrawW > 0) {
    // Top starts imgTopOffset above the CUSTOMER bar top
    page.drawImage(loadedDoorImg, {
      x: imgColX + (imgColW - imgDrawW) / 2,
      y: y - imgDrawH + STRIP_H + imgTopOffset,
      width: imgDrawW,
      height: imgDrawH,
    })
  }

  y -= sectionH
  y -= 4

  // ── TABLE ─────────────────────────────────────────────────────────────────
  // Columns
  const cNo    = ML
  const cItem  = ML + 18
  const cDesc  = ML + 130
  const cQtyX  = ML + CW - 195  // left of QTY col
  const cQtyW  = 30
  const cUpR   = ML + CW - 90   // right edge of UNIT PRICE
  const cTotR  = ML + CW        // right edge of TOTAL

  // Header row
  const TH = 18
  drawRect(page, ML, y - TH, CW, TH, BLACK)
  t(page,      'NO',          cNo + 2,  y - 12, bold, 8, WHITE)
  t(page,      'ITEM',        cItem,    y - 12, bold, 8, WHITE)
  t(page,      'DESCRIPTION', cDesc + 30, y - 12, bold, 8, WHITE)
  tCenter(page, 'QTY',        cQtyX, cQtyW, y - 12, bold, 8, WHITE)
  tRight(page, 'UNIT PRICE',  cUpR,     y - 12, bold, 8, WHITE)
  tRight(page, 'TOTAL',       cTotR,    y - 12, bold, 8, WHITE)
  y -= TH

  // Sub-header (WIDTH/HEIGHT aligned with data columns defined per-door below)
  const cWH = cDesc + 38   // WIDTH col (mirrors cW inside door loop)
  const cHH = cDesc + 92   // HEIGHT col (mirrors cH inside door loop)
  drawRect(page, ML, y - 13, CW, 13, rgb(0.93, 0.93, 0.93))
  t(page,      '#',      cNo + 2, y - 9, reg, 7, GREY)
  t(page,      'WIDTH',  cWH,     y - 9, reg, 7, GREY)
  t(page,      'HEIGHT', cHH,     y - 9, reg, 7, GREY)
  tCenter(page, '#',     cQtyX, cQtyW, y - 9, reg, 7, GREY)
  tRight(page,  '$',     cUpR,  y - 9, reg, 7, GREY)
  tRight(page,  '$$',    cTotR, y - 9, reg, 7, GREY)
  y -= 13

  // ── DOOR ROWS ─────────────────────────────────────────────────────────────
  for (let di = 0; di < doors.length; di++) {
    const d = doors[di]
    if (di > 0) { drawHLine(page, ML, y, CW, 0.5, rgb(0.55, 0.55, 0.55)); y -= 4 }

    // Column positions within description area
    // cDesc          = label qualifier (Clear:, External:, VF Drive:)
    // cDesc+38       = WIDTH value
    // cDesc+76       = 'x' / '-' separator column
    // cDesc+92       = HEIGHT value
    const cW  = cDesc + 38   // WIDTH value col
    const cX  = cDesc + 76   // separator ('x'/'-') col
    const cH  = cDesc + 92   // HEIGHT value col

    // Category row: smaller, regular weight to match reference
    const shortName = d.doorTypeName.replace(/ Rapid Door$/, '').replace(/ Door$/, '')
    const catDesc = `Rapid Roller Door (${shortName} | ${d.doorType})`
    drawRect(page, ML, y - 17, CW, 17, rgb(0.97, 0.97, 0.97))
    t(page, 'Industrial Door', cItem, y - 11, reg, 9,   DARK)
    t(page, catDesc,           cDesc, y - 11, reg, 9,   DARK)
    y -= 17

    // Row 1: Width × Height
    drawHLine(page, ML, y, CW, 0.5, rgb(0.82, 0.82, 0.82))
    const exW = d.externalW ?? ''
    const exH = d.externalH ?? ''
    t(page, '1.',             cNo + 2, y - 11, reg, 8.5, DARK)
    t(page, 'Width × Height', cItem,   y - 11, reg, 8.5, DARK)
    t(page, 'Clear:',         cDesc,   y - 11, reg, 8.5, DARK)
    t(page, d.openingW,       cW,      y - 11, reg, 8.5, DARK)
    t(page, 'x',              cX,      y - 11, reg, 8.5, DARK)
    t(page, d.openingH,       cH,      y - 11, reg, 8.5, DARK)
    // External row always shown
    t(page, 'External:',   cDesc,   y - 22, reg, 8, GREY)
    if (exW) t(page, exW,  cW,      y - 22, reg, 8, GREY)
    t(page, 'x',           cX,      y - 22, reg, 8, GREY)
    if (exH) t(page, exH,  cH,      y - 22, reg, 8, GREY)
    tCenter(page, String(d.qty),          cQtyX, cQtyW, y - 11, reg, 8.5, DARK)
    tRight(page,  fmtAUD(d.unitPrice),    cUpR,          y - 11, reg, 8.5, DARK)
    tRight(page,  fmtAUD(d.qty * d.unitPrice), cTotR,    y - 11, bold, 8.5, DARK)
    y -= 32

    // Partial-line widths for merged columns:
    //   rows 2-4: line stops at end of QTY (UNIT PRICE + TOTAL merged/blank)
    //   rows 5-7: line stops at end of UNIT PRICE (only TOTAL merged/blank)
    const lineToQty  = cQtyX + cQtyW - ML   // stop before UNIT PRICE
    const lineToUpR  = cUpR - ML            // stop before TOTAL

    // Row 2: Door Frame (UNIT PRICE + TOTAL merged)
    drawHLine(page, ML, y, lineToQty, 0.5, rgb(0.82, 0.82, 0.82))
    t(page, '2.',         cNo + 2, y - 11, reg, 8.5, DARK)
    t(page, 'Door Frame', cItem,   y - 11, reg, 8.5, DARK)
    const frameDisplay = d.frameRaw ?? d.frame
    t(page, frameDisplay, cW, y - 11, reg, 8.5, DARK)
    if (d.motorSide) { t(page, '-', cX, y - 11, reg, 8.5, DARK); t(page, d.motorSide, cH, y - 11, reg, 8.5, DARK) }
    y -= 18

    // Row 3: Curtain (UNIT PRICE + TOTAL merged)
    drawHLine(page, ML, y, lineToQty, 0.5, rgb(0.82, 0.82, 0.82))
    t(page, '3.',      cNo + 2, y - 11, reg, 8.5, DARK)
    t(page, 'Curtain', cItem,   y - 11, reg, 8.5, DARK)
    t(page, d.curtain, cW,      y - 11, reg, 8.5, DARK)
    if (d.colour) { t(page, '-', cX, y - 11, reg, 8.5, DARK); t(page, d.colour, cH, y - 11, reg, 8.5, DARK) }
    y -= 18

    // Row 4: Safety Edge (UNIT PRICE + TOTAL merged)
    drawHLine(page, ML, y, lineToQty, 0.5, rgb(0.82, 0.82, 0.82))
    t(page, '4.',          cNo + 2, y - 11, reg, 8.5, DARK)
    t(page, 'Safety Edge', cItem,   y - 11, reg, 8.5, DARK)
    t(page, 'SOFT',        cW,      y - 11, reg, 8.5, DARK)
    if (d.colour) { t(page, '-', cX, y - 11, reg, 8.5, DARK); t(page, d.colour, cH, y - 11, reg, 8.5, DARK) }
    y -= 18

    // Row 5: Drive System (TOTAL merged)
    drawHLine(page, ML, y, lineToUpR, 0.5, rgb(0.82, 0.82, 0.82))
    t(page, '5.',           cNo + 2, y - 11, reg, 8.5, DARK)
    t(page, 'Drive System', cItem,   y - 11, reg, 8.5, DARK)
    t(page, 'VF Drive:',    cDesc,   y - 11, reg, 8.5, DARK)
    if (d.motorKw) {
      t(page, d.motorKw, cW,      y - 11, reg, 8.5, DARK)
      t(page, 'up to',   cX + 10, y - 11, reg, 8.5, DARK)
    }
    y -= 18

    // Row 6: Safety Features (TOTAL merged, no gap when PEC not selected)
    drawHLine(page, ML, y, lineToUpR, 0.5, rgb(0.82, 0.82, 0.82))
    t(page, '6.',              cNo + 2, y - 11, reg, 8.5, DARK)
    t(page, 'Safety Features', cItem,   y - 11, reg, 8.5, DARK)
    const safetyVal = d.safetyByCategory?.safety ?? ''
    const hasPec = safetyVal && safetyVal !== '-'
    let sfY = y - 11
    if (hasPec) {
      t(page, safetyVal,      cW,    sfY, reg, 8.5, DARK)
      tCenter(page, '1',      cQtyX, cQtyW, sfY, reg, 8, DARK)
      tRight(page, '(incl.)', cUpR,  sfY, reg, 8, GREY)
      sfY -= 13
    }
    t(page, 'Hazard Lamp',   cW,    sfY, reg, 8.5, DARK)
    tCenter(page, '1',       cQtyX, cQtyW, sfY, reg, 8, DARK)
    tRight(page, '(incl.)',  cUpR,  sfY, reg, 8, GREY)
    y -= hasPec ? 30 : 18

    // Row 7: Detection — all 5 sub-rows with separators, TOTAL merged
    drawHLine(page, ML, y, lineToUpR, 0.5, rgb(0.82, 0.82, 0.82))
    t(page, '7.',        cNo + 2, y - 11, reg, 8.5, DARK)
    t(page, 'Detection', cItem,   y - 11, reg, 8.5, DARK)
    const allDetection: [string, string, string][] = [
      ['a', 'Push Button',             d.safetyByCategory?.pushButton   ?? ''],
      ['b', 'Radar (1set)',            d.safetyByCategory?.radar        ?? ''],
      ['c', 'Remote Control',         d.safetyByCategory?.remoteControl ?? ''],
      ['d', 'Induction Loop',         d.safetyByCategory?.inductLoop    ?? ''],
      ['e', 'Contactless Exit Button', d.safetyByCategory?.swipe        ?? ''],
    ]
    allDetection.forEach(([letter, label, val], i) => {
      const isSelected = val && val !== '-'
      if (i > 0) drawHLine(page, ML, y - i * 13, lineToUpR, 0.3, rgb(0.88, 0.88, 0.88))
      t(page, `${letter}:`, cDesc,      y - 11 - i * 13, reg, 8.5, DARK)
      t(page, label,        cDesc + 16, y - 11 - i * 13, reg, 8.5, DARK)
      tCenter(page, isSelected ? '1' : '-', cQtyX, cQtyW, y - 11 - i * 13, reg, 8, DARK)
      tRight(page, isSelected ? '(incl.)' : '(excl.)', cUpR, y - 11 - i * 13, reg, 8, isSelected ? GREY : rgb(0.6, 0.6, 0.6))
    })
    y -= allDetection.length * 13 + 8

  }

  // Blank ruled lines after table (reference style)
  const blankRowH = 14
  const blankRowCount = 4
  for (let i = 0; i < blankRowCount; i++) {
    drawHLine(page, ML, y, CW, 0.4, rgb(0.82, 0.82, 0.82))
    y -= blankRowH
  }
  drawHLine(page, ML, y, CW, 0.4, rgb(0.82, 0.82, 0.82))

  y -= 20

  // ── EXTRA COST ROWS (only when summary page is excluded, last door only) ──
  let extrasTotal = 0
  const isLastDoor = doorIndex === totalDoors - 1
  if (!includeSummary && isLastDoor) {
    const totalInst  = allDoors.reduce((s, d) => s + (d.installation ?? 0), 0)
    const totalDemol = allDoors.reduce((s, d) => s + (d.demolition  ?? 0), 0)
    const totalEquip = allDoors.reduce((s, d) => s + (d.equipHire   ?? 0), 0)
    const totalTravel= allDoors.reduce((s, d) => s + (d.accTravel   ?? 0), 0)
    extrasTotal = totalInst + totalDemol + totalEquip + totalTravel

    const extraRows: [string, number][] = [
      ['Installation',              totalInst],
      ['Demolition',                totalDemol],
      ['Equipment Hire',            totalEquip],
      ['Accommodation & Travel',    totalTravel],
    ]
    extraRows.forEach(([label, amt]) => {
      drawHLine(page, ML, y, CW, 0.4, rgb(0.82, 0.82, 0.82))
      t(page, label, cItem, y - 11, reg, 8.5, DARK)
      if (amt > 0) {
        tCenter(page, '1',         cQtyX, cQtyW, y - 11, reg, 8, DARK)
        tRight(page, fmtAUD(amt),  cUpR,          y - 11, reg, 8.5, DARK)
        tRight(page, fmtAUD(amt),  cTotR,         y - 11, reg, 8.5, DARK)
      } else {
        tCenter(page, '-',          cQtyX, cQtyW, y - 11, reg, 8, GREY)
        tRight(page, '(excl.)',     cUpR,          y - 11, reg, 8, GREY)
        tRight(page, '-',           cTotR,         y - 11, reg, 8, GREY)
      }
      y -= 14
    })
    drawHLine(page, ML, y, CW, 0.4, rgb(0.82, 0.82, 0.82))
    y -= 20
  }

  // ── TOTALS + BANK DETAILS ─────────────────────────────────────────────────
  drawHLine(page, ML, y, CW, 0.5, DARK)
  y -= 10

  const totLR = ML + CW - 70
  const totVR = ML + CW

  // Per-door pages show only that door's total; only the last page with no summary shows the combined grand total
  const subtotal = (!includeSummary && isLastDoor ? grandTotal : door.lineTotal) + extrasTotal

  // Bank details — left side, aligned with totals
  t(page, 'BANK DETAILS',                             ML, y,      bold, 8.5, DARK)
  t(page, 'Account Name: NBE Australia Pty Ltd',      ML, y - 14, reg,  8,   DARK)
  t(page, 'BSB: 013-525  |  Account No.: 3473-93755', ML, y - 26, reg,  8,   DARK)

  tRight(page, 'Subtotal',             totLR, y,      reg, 10, DARK)
  tRight(page, fmtAUD(subtotal),       totVR, y,      reg, 10, DARK)
  tRight(page, 'GST (10%)',            totLR, y - 18, reg, 10, DARK)
  tRight(page, fmtAUD(subtotal * 0.1), totVR, y - 18, reg, 10, DARK)

  drawHLine(page, ML + CW - 170, y - 26, 170, 0.5)

  const totBoxW = 170
  const totBoxY = y - 48
  drawRect(page, ML + CW - totBoxW, totBoxY, totBoxW, 22, BLACK)
  t(page,      'TOTAL',                  ML + CW - totBoxW + 8, totBoxY + 6, bold, 11, WHITE)
  tRight(page, fmtAUD(subtotal * 1.1),   ML + CW,               totBoxY + 6, bold, 11, WHITE)

  y = totBoxY - 22

  // ── FOOTER TERMS ─────────────────────────────────────────────────────────
  const DEFAULT_PAGE1_DISCLAIMER = 'This quotation is based on the NBE Standard Door comprising a galvanized frame, PVC curtain (900 g/m²), and a zinc-coated control box (RAL 7035). Optional extras (e.g. powder coating, light curtain, remote control, radar, traffic light, induction loop, contactless exit button) are available at additional cost. All other matters shall be subject to our standard Terms and Conditions (T&C). The electrical scope is limited to the connection between the control panel and the doors only. Power supply and isolator shall be provided by others.'
  const terms = input.page1Disclaimer?.trim() || DEFAULT_PAGE1_DISCLAIMER
  const footerSize = 7.5
  const footerLines = terms.split('\n').flatMap(para => wrapText(para, reg, footerSize, CW))
  footerLines.forEach((ln, i) => {
    page.drawText(ln, { x: ML, y: y - i * 10, size: footerSize, font: reg, color: GREY })
  })
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
  const DEFAULT_PAGE2_SUMMARY_NOTE = "Subject to NBE Australia's standard Terms & Conditions. Final dimensions, site conditions and access must be confirmed prior to manufacture. Delivery, equipment hire and installation are excluded unless shown as priced line items. Electrical works are limited to connections between the control panel and door equipment. Power supply and isolator shall be provided by others."
  const terms = input.page2SummaryNote?.trim() || DEFAULT_PAGE2_SUMMARY_NOTE
  const footerSize = 8.5
  const footerLineH = 11
  const footerLines = terms.split('\n').flatMap(para => wrapText(para, reg, footerSize, CW))
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

  const includeSummary = input.includeSummary !== false  // default true

  // One page-1 per door (reference layout)
  for (let i = 0; i < doors.length; i++) {
    await drawPage1(pdfDoc, input, doors[i], i, doors.length, grandTotal, fonts, logoImg, doors, includeSummary)
  }

  // Final page — summary of all doors (skipped if user opted out)
  if (includeSummary) {
    await drawPage2(pdfDoc, input, doors, grandTotal, fonts, logoImg)
  }

  // ── Append T&C pages based on end-user type ───────────────────────────────
  const TC_FILES: Record<string, string> = {
    CUSTOMER:    'Rapid Door_T&C for CUSTOMERS.pdf',
    DISTRIBUTOR: 'Rapid Door_T&C for DISTRIBUTOR.pdf',
    TENDER:      'Rapid Door_T&C for TENDER.pdf',
  }
  const tcFile = input.endUser ? TC_FILES[input.endUser] : null
  if (tcFile) {
    try {
      const tcBytes = await readFile(path.join(process.cwd(), 'public', 'documents', tcFile))
      const tcDoc   = await PDFDocument.load(tcBytes)
      const indices = tcDoc.getPageIndices()
      const copied  = await pdfDoc.copyPages(tcDoc, indices)
      copied.forEach(p => pdfDoc.addPage(p))
    } catch (e) {
      console.error('Failed to append T&C:', e)
    }
  }

  return pdfDoc.save()
}
