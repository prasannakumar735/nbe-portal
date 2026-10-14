import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'

// Brand colour for PVC Flex headings
const BRAND  = rgb(0x00 / 255, 0xB0 / 255, 0x50 / 255)
const DARK   = rgb(0.08, 0.08, 0.08)
const MID    = rgb(0.35, 0.35, 0.35)
const WHITE  = rgb(1, 1, 1)
const AMBER_BG = rgb(1, 0.97, 0.88)
const AMBER_BD = rgb(0.85, 0.65, 0.10)

// ── Types ────────────────────────────────────────────────────────────────────

export type PvcFlexJobCardDoor = {
  doorLabel:    string   // e.g. "Door 1"
  openingW:     number   // mm
  openingH:     number   // mm
  stripWidth:   number   // mm
  thickness:    number   // mm
  grade:        string   // Ambient | Freezer
  profile:      string   // Ribbed | Flat | Coloured
  hanger:       string   // Galvanised | Stainless Steel
  supplyType:   string   // Whole Door | Strip Curtain Only | Headrail Only
  numStrips:    number
  cutLengthMm:  number   // strip length (cut)
  coverageM:    number   // headrail run (m), only if headrail supplied
  sliding?:     string   // NA | Single | Dual
  raisedHeadrail?: string  // NA or size string
  qty:          number
}

export type PvcFlexJobCardInput = {
  jobCardNumber:   string   // JCPF-YYMMDD-NNN
  quoteNumber:     string
  assignedToName:  string
  poReference?:    string
  jobName?:        string
  requiredBy?:     string
  notes?:          string
  createdDate:     string   // display string e.g. "14 Oct 2026"
  customerName:    string
  customerAttn?:   string
  customerAddress: string
  scopeOfWork?:    string   // e.g. "Supply & Install" | "Supply Only"
  doors:           PvcFlexJobCardDoor[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeText(s: string) {
  return s.replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\xFF]/g, ' ').replace(/\s+/g, ' ').trim()
}

function t(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 9, color = DARK) {
  const s = safeText(text)
  if (!s) return
  page.drawText(s, { x, y, size, font, color })
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color = rgb(0.93, 0.93, 0.93)) {
  page.drawRectangle({ x, y, width: w, height: h, color })
}

function drawHLine(page: PDFPage, x: number, y: number, w: number, thickness = 0.5, color = rgb(0.78, 0.78, 0.78)) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color })
}

function drawVLine(page: PDFPage, x: number, y: number, h: number, thickness = 0.5, color = rgb(0.78, 0.78, 0.78)) {
  page.drawLine({ start: { x, y }, end: { x, y: y - h }, thickness, color })
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    const words = para.replace(/[^\x20-\xFF]/g, ' ').replace(/\s+/g, ' ').trim().split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) <= maxW) { line = test }
      else { if (line) lines.push(line); line = word }
    }
    if (line) lines.push(line)
  }
  return lines
}

// ── Section header bar ───────────────────────────────────────────────────────
function drawSectionHeader(
  page: PDFPage, label: string,
  x: number, y: number, w: number, h: number,
  bold: PDFFont,
) {
  drawRect(page, x, y - h, w, h, DARK)
  t(page, label, x + 8, y - h + 5, bold, 9, WHITE)
}

// ── Two-cell label/value helper ──────────────────────────────────────────────
function labelValue(
  page: PDFPage, label: string, value: string,
  lx: number, vx: number, y: number,
  reg: PDFFont, bold: PDFFont,
) {
  t(page, label, lx, y, bold, 7.5, MID)
  t(page, value || '—', vx, y, reg, 8.5, DARK)
}

// ── Checklist item ───────────────────────────────────────────────────────────
function checkItem(page: PDFPage, label: string, note: string, x: number, y: number, bold: PDFFont, reg: PDFFont) {
  // checkbox square
  page.drawRectangle({ x, y: y - 7, width: 8, height: 8, borderColor: DARK, borderWidth: 0.8, color: WHITE })
  t(page, label, x + 12, y, bold, 8, DARK)
  t(page, note, x + 12, y - 11, reg, 7.5, MID)
}

// ── PDF generator ────────────────────────────────────────────────────────────

export async function generatePvcFlexJobCardPdf(input: PvcFlexJobCardInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const roboto = await embedRobotoForPdfLib(pdfDoc)
  const reg  = roboto?.regular ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))
  const bold = roboto?.bold    ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))

  const PW = 595.28
  const ML = 36, MR = 36
  const CW = PW - ML - MR
  const SAFE_BOTTOM = 50   // footer is at y=32; give a little clearance

  // Logo
  let logoImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    logoImg = await pdfDoc.embedPng(
      new Uint8Array(await readFile(path.join(process.cwd(), 'public', 'NBE_LOGO_BK_PL.png')))
    )
  } catch {}

  let page: PDFPage = null!
  let y = 800
  let pageNum = 0

  // ── Page header ────────────────────────────────────────────────────────────
  function startPage() {
    pageNum++
    page = pdfDoc.addPage([PW, 841.89])
    y = 800

    // Logo
    const logoH = 44
    if (logoImg) {
      const { width: lw, height: lh } = logoImg
      page.drawImage(logoImg, { x: ML, y: y - logoH, width: (lw / lh) * logoH, height: logoH })
    } else {
      t(page, 'NBE Australia', ML, y - 14, bold, 13, DARK)
    }

    // Title (right-aligned)
    t(page, 'PVC FLEX SYSTEM', PW - MR - bold.widthOfTextAtSize('PVC FLEX SYSTEM', 18), y - 20, bold, 18, BRAND)
    t(page, 'MANUFACTURING JOB CARD', PW - MR - reg.widthOfTextAtSize('MANUFACTURING JOB CARD', 10), y - 36, reg, 10, MID)
    t(page, '22A Humeside Drive, Campbellfield VIC 3061  •  Ph: 03 9357 5858', ML, y - logoH - 6, reg, 7.5, MID)
    y -= logoH + 22
    drawHLine(page, ML, y, CW, 1, DARK)
    y -= 4

    // Page footer bar
    drawHLine(page, ML, 32, CW, 0.5, DARK)
    t(page, 'NBE Australia Pty Ltd  •  ABN 17 007 048 008', ML, 18, reg, 7.5, MID)
    t(page, `Internal Manufacturing Job Card   |   Page ${pageNum}`, PW - MR - reg.widthOfTextAtSize(`Internal Manufacturing Job Card   |   Page ${pageNum}`, 7.5), 18, reg, 7.5, MID)
  }

  startPage()

  // ── JOB DETAILS ────────────────────────────────────────────────────────────
  const JD_H = 72
  drawSectionHeader(page, 'JOB DETAILS', ML, y, CW, 18, bold)
  y -= 18
  drawRect(page, ML, y - JD_H, CW, JD_H, rgb(0.97, 0.97, 0.97))

  // 4-column grid inside Job Details
  const col = CW / 4
  const jdVals: [string, string][] = [
    ['JOB CARD',           input.jobCardNumber],
    ['QUOTE',              input.quoteNumber],
    ['STATUS',             'APPROVED'],
    ['ASSIGNED TO',        input.assignedToName],
    ['PO / CUSTOMER REF.', input.poReference || '—'],
    ['CREATED',            input.createdDate],
    ['REQUIRED BY',        input.requiredBy || '—'],
    ['',                   ''],
  ]
  jdVals.forEach(([label, val], i) => {
    const col4 = i % 4
    const row  = Math.floor(i / 4)
    const cx   = ML + col4 * col + 6
    const cy   = y - 14 - row * 32
    t(page, label, cx, cy, bold, 7, MID)
    t(page, val,   cx, cy - 13, bold, i === 2 ? 10 : 8.5, i === 2 ? BRAND : DARK)
  })

  // vertical dividers
  for (let c = 1; c < 4; c++) {
    drawVLine(page, ML + c * col, y - 2, JD_H - 4, 0.4)
  }
  drawHLine(page, ML, y - JD_H / 2 - 4, CW, 0.4)
  drawRect(page, ML, y - JD_H, CW, 0, DARK)  // bottom border
  drawHLine(page, ML, y - JD_H, CW, 0.8, DARK)
  y -= JD_H + 10

  // ── CUSTOMER & SITE ────────────────────────────────────────────────────────
  const CS_H = 50
  drawSectionHeader(page, 'CUSTOMER & SITE', ML, y, CW, 18, bold)
  y -= 18
  drawRect(page, ML, y - CS_H, CW, CS_H, rgb(0.97, 0.97, 0.97))
  drawHLine(page, ML, y - CS_H, CW, 0.8, DARK)

  const half = CW / 2
  // Row 1: Customer | Site Contact
  labelValue(page, 'CUSTOMER',     input.customerName,        ML + 6, ML + 6 + 72,         y - 12, reg, bold)
  labelValue(page, 'SITE CONTACT', input.customerAttn || '—', ML + half + 6, ML + half + 82, y - 12, reg, bold)
  // Row 2: Site Address | Scope of Work
  labelValue(page, 'SITE ADDRESS', input.customerAddress,      ML + 6, ML + 6 + 72,         y - 30, reg, bold)
  labelValue(page, 'SCOPE OF WORK', input.scopeOfWork || '—', ML + half + 6, ML + half + 82, y - 30, reg, bold)
  drawHLine(page, ML, y - 20, CW, 0.3, rgb(0.88, 0.88, 0.88))
  drawVLine(page, ML + half, y - 4, CS_H - 8, 0.4)
  y -= CS_H + 10

  // ── JOB INSTRUCTIONS (only if notes) ──────────────────────────────────────
  const notes = (input.notes ?? '').trim()
  if (notes) {
    const noteLines = wrapText(notes, reg, 8.5, CW - 90)
    const NH = Math.max(28, noteLines.length * 12 + 16)
    drawSectionHeader(page, 'JOB INSTRUCTIONS', ML, y, CW, 18, bold)
    y -= 18
    drawRect(page, ML, y - NH, CW, NH, AMBER_BG)
    page.drawRectangle({ x: ML, y: y - NH, width: CW, height: NH, borderColor: AMBER_BD, borderWidth: 0.7, color: AMBER_BG })
    t(page, 'IMPORTANT', ML + 8, y - 12, bold, 8, rgb(0.7, 0.45, 0))
    noteLines.forEach((ln, li) => {
      t(page, ln, ML + 80, y - 12 - li * 12, reg, 8.5, DARK)
    })
    y -= NH + 10
  }

  // ── Per-door sections ──────────────────────────────────────────────────────
  for (const door of input.doors) {
    const includeStrips   = door.supplyType !== 'Headrail Only'
    const includeHeadrail = door.supplyType !== 'Strip Curtain Only'

    // Layout: 5 rows × 17px each + strip count bar 24px + padding
    const ROW_H    = 17
    const COL_ROWS = 5
    const colsH    = COL_ROWS * ROW_H          // 85
    const STRIP_BAR = 24
    const doorH    = colsH + STRIP_BAR + 8     // 117
    const DOOR_BLOCK = doorH + 20              // header + body

    if (y - DOOR_BLOCK < SAFE_BOTTOM) startPage()

    // Door header
    drawRect(page, ML, y - 20, CW, 20, rgb(0, 0x70 / 255, 0x30 / 255))
    t(page, `${door.doorLabel}  —  ${door.supplyType.toUpperCase()}`, ML + 8, y - 14, bold, 10, WHITE)
    if (door.qty > 1) {
      const qText = `QTY: ${door.qty}`
      t(page, qText, PW - MR - bold.widthOfTextAtSize(qText, 9) - 8, y - 14, bold, 9, rgb(0.8, 1, 0.8))
    }
    y -= 20

    // Door body background
    drawRect(page, ML, y - doorH, CW, doorH, rgb(0.975, 0.975, 0.99))
    drawHLine(page, ML, y - doorH, CW, 0.8, DARK)

    // Column positions
    const half = CW / 2
    const L1 = ML + 8
    const V1 = ML + 105
    const L2 = ML + half + 6
    const V2 = ML + half + 105

    // ── Column 1: Strip type / profile / size / thickness / rivets ──
    const col1Rows: [string, string][] = [
      ['STRIP TYPE',        door.grade],
      ['STRIP PROFILE',     door.profile],
      ['STRIP SIZE',        `${door.stripWidth} mm`],
      ['STRIP THICKNESS',   `${door.thickness} mm`],
      ['RIVETS & HANGERS',  door.hanger],
    ]

    // ── Column 2: Strip length / door height / width / headrail ──
    const col2Rows: [string, string][] = [
      ['STRIP LENGTH',      includeStrips   ? `${door.cutLengthMm} mm` : '—'],
      ['DOOR HEIGHT',       `${door.openingH} mm`],
      ['DOOR WIDTH',        `${door.openingW} mm`],
      ['HEADRAIL LENGTH',   includeHeadrail ? `${door.coverageM.toFixed(2)} m` : '—'],
      ['HEADRAIL HARDWARE', includeHeadrail ? door.hanger : '—'],
    ]

    col1Rows.forEach(([label, val], i) => {
      const ry = y - 14 - i * ROW_H
      t(page, label, L1, ry, bold, 7, MID)
      t(page, val,   V1, ry, reg, 8.5, DARK)
    })
    col2Rows.forEach(([label, val], i) => {
      const ry = y - 14 - i * ROW_H
      t(page, label, L2, ry, bold, 7, MID)
      t(page, val,   V2, ry, reg, 8.5, DARK)
    })

    // Centre divider (columns)
    drawVLine(page, ML + half, y - 2, colsH + 4, 0.4)

    // ── Strip count bar ──────────────────────────────────────────────
    const totalStrips = door.numStrips * door.qty
    const barY = y - colsH - 6
    drawHLine(page, ML, barY + 2, CW, 0.5)
    drawRect(page, ML, barY - STRIP_BAR, CW, STRIP_BAR, rgb(0.94, 0.99, 0.95))
    const scLabel  = 'TOTAL STRIP COUNT'
    const scVal    = String(totalStrips)
    const scSub    = door.qty > 1 ? `(${door.numStrips} strips × ${door.qty} doors)` : `(${door.numStrips} strips per door)`
    const scLabelW = bold.widthOfTextAtSize(scLabel, 8)
    const scValW   = bold.widthOfTextAtSize(scVal, 18)
    const barCx    = ML + CW / 2
    t(page, scLabel, barCx - scLabelW - 12,          barY - STRIP_BAR / 2 - 3,  bold, 8,   MID)
    t(page, scVal,   barCx + 8,                       barY - STRIP_BAR / 2 - 9,  bold, 18,  BRAND)
    t(page, scSub,   barCx + 8 + scValW + 6,          barY - STRIP_BAR / 2 - 3,  reg,  7.5, MID)

    y -= doorH + 10
  }

  // ── Checklist ─────────────────────────────────────────────────────────────
  const pageBeforeChecklist = pageNum
  const CL = ML + 10
  const CR = ML + CW / 2 + 10
  const CH = 24
  const checkLeft: [string, string][] = [
    ['1. Materials allocated',          'Check the PVC strip size and thickness.'],
    ['2. Rivets & hangers material',    'Confirm Galvanised or Stainless Steel.'],
    ['3. Door measurement',             'Measure and confirm the required height / strip length.'],
    ['4. PVC strips cut',               'Cut according to the required door length.'],
  ]
  const checkRight: [string, string][] = [
    ['5. Quantity checked',             'Confirm the required strip count.'],
    ['6. Packaging',                    'Select the proper packaging boxes and pack securely.'],
    ['7. Headrail / hardware prepared', 'Confirm all required hardware is ready.'],
    ['8. Headrail packed',              'Pack the headrail securely for delivery.'],
  ]
  // Height: top offset 14 + 4 items × 24 + bottom pad 10
  const CHECKLIST_H = 14 + checkLeft.length * CH + 10

  if (y - CHECKLIST_H < SAFE_BOTTOM) startPage()

  drawSectionHeader(page, 'MANUFACTURING PREPARATION CHECKLIST', ML, y, CW, 18, bold)
  y -= 18
  drawRect(page, ML, y - CHECKLIST_H, CW, CHECKLIST_H, rgb(0.97, 0.97, 0.97))
  drawHLine(page, ML, y - CHECKLIST_H, CW, 0.8, DARK)

  checkLeft.forEach(([label, note], i) => {
    checkItem(page, label, note, CL, y - 14 - i * CH, bold, reg)
  })
  checkRight.forEach(([label, note], i) => {
    checkItem(page, label, note, CR, y - 14 - i * CH, bold, reg)
  })
  drawVLine(page, ML + CW / 2, y - 2, CHECKLIST_H - 4, 0.4)
  y -= CHECKLIST_H + 10

  // ── Completion ───────────────────────────────────────────────────────────
  // 1 door → always show
  // 2+ doors → only show if checklist spilled onto a new page
  const checklistSpilled = pageNum > pageBeforeChecklist
  const showCompletion = input.doors.length === 1 || checklistSpilled
  if (!showCompletion) {
    pdfDoc.setTitle(`${input.jobCardNumber}_PVC_FLEX_JOBCARD`) // multi-door single-page: skip completion
    return pdfDoc.save()
  }

  const COMP_H = 52
  if (y - COMP_H < SAFE_BOTTOM) startPage()

  drawSectionHeader(page, 'MANUFACTURING COMPLETION', ML, y, CW, 18, bold)
  y -= 18
  drawRect(page, ML, y - COMP_H, CW, COMP_H, rgb(0.97, 0.97, 0.97))
  drawHLine(page, ML, y - COMP_H, CW, 0.8, DARK)

  t(page, 'PREPARED BY', ML + 6, y - 12, bold, 7, MID)
  drawHLine(page, ML + 6, y - 28, 140, 0.8, DARK)

  t(page, 'DATE', ML + 175, y - 12, bold, 7, MID)
  drawHLine(page, ML + 175, y - 28, 100, 0.8, DARK)

  t(page, 'STATUS', ML + 310, y - 12, bold, 7, MID)
  const statuses = ['Complete', 'Partial', 'Issue']
  statuses.forEach((s, i) => {
    const sx = ML + 310 + i * 72
    page.drawRectangle({ x: sx, y: y - 28, width: 9, height: 9, borderColor: DARK, borderWidth: 0.8, color: WHITE })
    t(page, s, sx + 13, y - 20, bold, 8, DARK)
  })
  y -= COMP_H

  pdfDoc.setTitle(`${input.jobCardNumber}_PVC_FLEX_JOBCARD`)
  return pdfDoc.save()
}
