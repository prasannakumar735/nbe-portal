import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'

const PVC_COLOR = rgb(0.0, 0.51, 0.51)  // #008282 teal — PVC Flex identity
const DARK  = rgb(0.08, 0.08, 0.08)
const GREY  = rgb(0.40, 0.40, 0.40)
const WHITE = rgb(1,    1,    1)
const BLACK = rgb(0,    0,    0)

export type PvcFlexDoorLineItem = {
  item:          string   // e.g. "Door 1"
  description:   string   // multi-line spec (newline-separated)
  qty:           number
  unitPrice:     number   // discounted sell price
  originalPrice: number   // sell price before discount (for savings note)
}

export type PvcFlexQuotePdfInput = {
  quoteNumber:      string
  date:             string
  validUntil:       string
  customerName:     string
  customerAttn:     string
  customerAddress:  string
  customerPostcode: string
  customerPhone:    string
  customerEmail:    string
  doors:            PvcFlexDoorLineItem[]
  delivery?:        number
  installation?:    number
  discountPct?:     number
  terms?:           string
  endUser?:         'CUSTOMER' | 'DISTRIBUTOR' | 'TENDER'
  senderName?:      string
  senderAddress?:   string
  senderEmail?:     string
  contactName?:     string
  contactPhone?:    string
  contactEmail?:    string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawHLine(page: PDFPage, x: number, y: number, w: number, thickness = 0.5, color = rgb(0.75, 0.75, 0.75)) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color })
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, color = rgb(0.93, 0.93, 0.93)) {
  page.drawRectangle({ x, y, width: w, height: h, color })
}

function safeText(s: string) { return s.replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\xFF]/g, ' ').replace(/\s+/g, ' ').trim() }

function t(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size = 9, color = DARK) {
  const s = safeText(text); if (!s) return
  page.drawText(s, { x, y, size, font, color })
}

function tRight(page: PDFPage, text: string, xRight: number, y: number, font: PDFFont, size = 9, color = DARK) {
  const s = safeText(text); if (!s) return
  page.drawText(s, { x: xRight - font.widthOfTextAtSize(s, size), y, size, font, color })
}

function tCenter(page: PDFPage, text: string, xLeft: number, colW: number, y: number, font: PDFFont, size = 9, color = DARK) {
  const s = safeText(text); if (!s) return
  const w = font.widthOfTextAtSize(s, size)
  page.drawText(s, { x: xLeft + (colW - w) / 2, y, size, font, color })
}

function fmtAUD(n: number) {
  const parts = n.toFixed(2).split('.')
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `$${int}.${parts[1]}`
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safe  = safeText(text)
  const words = safe.split(' ')
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

async function embedDisplayFont(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  try {
    return await pdfDoc.embedFont(
      await readFile(path.join(process.cwd(), 'public', 'fonts', 'Jost-Light.ttf')),
      { subset: true },
    )
  } catch { return null }
}

// ── PDF generator ─────────────────────────────────────────────────────────────

export async function generatePvcFlexQuotePdf(input: PvcFlexQuotePdfInput): Promise<Uint8Array> {
  const pdfDoc    = await PDFDocument.create()
  const roboto    = await embedRobotoForPdfLib(pdfDoc)
  const jostLight = await embedDisplayFont(pdfDoc)
  const reg    = roboto?.regular ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))
  const bold   = roboto?.bold    ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
  const italic = roboto?.italic  ?? (await pdfDoc.embedFont(StandardFonts.HelveticaOblique))
  const display: import('pdf-lib').PDFFont = jostLight ?? reg

  const PW = 595.28, ML = 36, MR = 36, CW = PW - ML - MR

  // ── Column geometry (fixed) ───────────────────────────────────────────────────
  const cNo      = ML
  const cNoW     = 24
  const cItem    = ML + cNoW
  const cItemW   = 60
  const cDesc    = cItem + cItemW
  const cQtyX    = ML + CW - 130
  const cQtyW    = 28
  const cUpRight  = ML + CW - 60
  const cTotRight = ML + CW
  const cDescW    = cQtyX - cDesc

  const BASE_ROW_H  = 14
  const DESC_LINE_H = 11
  const FILLER_ROW_H = BASE_ROW_H + 4

  // ── Pre-compute row data ──────────────────────────────────────────────────────
  type DoorRowData = { door: PvcFlexDoorLineItem; idx: number; descLines: string[]; rowH: number }
  const doorRows: DoorRowData[] = input.doors.map((door, i) => {
    const descLines = door.description.split('\n').filter(Boolean)
    const rowH = Math.max(BASE_ROW_H, descLines.length * DESC_LINE_H + 8)
    return { door, idx: i, descLines, rowH }
  })

  const delivN = input.delivery    ?? 0
  const instN  = input.installation ?? 0
  const extraRows = (instN > 0 ? 1 : 0) + (delivN > 0 ? 1 : 0)
  const usedRows  = input.doors.length + extraRows
  const MIN_ROWS  = 8
  const fillerCount = Math.max(0, MIN_ROWS - usedRows)

  // ── Footer terms ─────────────────────────────────────────────────────────────
  const DEFAULT_TERMS = "This quotation covers the PVC strip curtain system(s) listed above. Strip configurations are calculated from nominated opening dimensions; final measurements must be verified on-site before manufacture. Pricing is valid for 30 days from date of issue. Delivery and installation are excluded unless shown as priced line items. All supply and installation is subject to NBE Australia's standard Terms & Conditions."
  const terms       = safeText(input.terms?.trim() || DEFAULT_TERMS)
  const footerSize  = 8, footerLineH = 11
  const footerColor = rgb(0x33/255, 0x33/255, 0x33/255)
  const footerLines = wrapText(terms, italic, footerSize, CW)
  const footerStartY = 52 + (footerLines.length - 1) * footerLineH

  // ── Pagination simulation ─────────────────────────────────────────────────────
  const SAFE_BOTTOM   = 50
  const Y_ROWS_P1     = 462   // y after full page-1 header + table header
  const Y_ROWS_CONT   = 678   // y after continuation header + table header
  const TOTALS_NEEDED = 70    // bank details + subtotal + gst + total box
  const MIN_Y_FOR_TOTALS = footerStartY + TOTALS_NEEDED + 24

  const simulateTotalPages = (): number => {
    let simY = Y_ROWS_P1, pages = 1
    for (const rd of doorRows) {
      if (simY - rd.rowH < SAFE_BOTTOM) { pages++; simY = Y_ROWS_CONT }
      simY -= rd.rowH
    }
    if (instN > 0) {
      if (simY - FILLER_ROW_H < SAFE_BOTTOM) { pages++; simY = Y_ROWS_CONT }
      simY -= FILLER_ROW_H
    }
    if (delivN > 0) {
      if (simY - FILLER_ROW_H < SAFE_BOTTOM) { pages++; simY = Y_ROWS_CONT }
      simY -= FILLER_ROW_H
    }
    for (let i = 0; i < fillerCount; i++) {
      if (simY - FILLER_ROW_H < SAFE_BOTTOM) { pages++; simY = Y_ROWS_CONT }
      simY -= FILLER_ROW_H
    }
    simY -= 18
    if (simY < MIN_Y_FOR_TOTALS) pages++
    return pages
  }
  const totalPages = simulateTotalPages()

  // ── Logo embed ────────────────────────────────────────────────────────────────
  let logoImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'NBE_LOGO_BK_PL.png'))
    logoImg = await pdfDoc.embedPng(new Uint8Array(logoBytes))
  } catch {}

  // ── Rendering state ───────────────────────────────────────────────────────────
  let page: PDFPage = null!
  let y = 800
  let pageNum = 0

  const drawTableHeader = () => {
    const TH = 20
    drawRect(page, ML, y - TH, CW, TH, BLACK)
    t(page,       'NO',          cNo + 2,   y - 13, bold, 8, WHITE)
    t(page,       'ITEM',        cItem,     y - 13, bold, 8, WHITE)
    tCenter(page, 'DESCRIPTION', cDesc, cDescW, y - 13, bold, 8, WHITE)
    tCenter(page, 'QTY',         cQtyX,    cQtyW, y - 13, bold, 8, WHITE)
    tRight(page,  'UNIT PRICE',  cUpRight,         y - 13, bold, 8, WHITE)
    tRight(page,  'TOTAL',       cTotRight - 4,    y - 13, bold, 8, WHITE)
    y -= TH
    const SH = 14
    t(page,      '#',  cNo + 2,  y - 9, reg, 8, BLACK)
    tCenter(page, '#', cQtyX, cQtyW, y - 9, reg, 8, BLACK)
    tRight(page,  '$',  cUpRight,      y - 9, reg, 8, BLACK)
    tRight(page,  '$$', cTotRight - 4, y - 9, reg, 8, BLACK)
    y -= SH
    drawHLine(page, ML, y, CW, 1.2, DARK)
    y -= 2
  }

  const drawPageFooterBar = () => {
    drawHLine(page, ML, 38, CW, 0.5, DARK)
    t(page, 'NBE AUSTRALIA',       ML,       20, bold, 7.5, DARK)
    t(page, 'nbeaustralia.com.au', ML + 75,  20, reg,  7,   GREY)
    tRight(page, `Quote No. ${input.quoteNumber} | PVC FLEX SYSTEMS | Page ${pageNum} of ${totalPages}`, ML + CW, 20, reg, 7.5, GREY)
  }

  const CUST_COLOR = rgb(31 / 255, 41 / 255, 51 / 255)

  const startPage = (isFirst: boolean) => {
    if (pageNum > 0) drawPageFooterBar()
    pageNum++
    page = pdfDoc.addPage([595.28, 841.89])
    y = 800

    const logoH = 50
    if (logoImg) {
      const { width: lw, height: lh } = logoImg
      page.drawImage(logoImg, { x: ML, y: y - logoH, width: (lw / lh) * logoH, height: logoH })
    } else {
      t(page, 'NBE australia', ML, y - 22, bold, 20, BLACK)
    }
    t(page, 'QUOTE', PW - MR - display.widthOfTextAtSize('QUOTE', 36), y - 26, display, 36, BLACK)
    const subtitle = 'PVC FLEX SYSTEMS'
    t(page, subtitle, PW - MR - bold.widthOfTextAtSize(subtitle, 14), y - 52, bold, 14, PVC_COLOR)
    if (isFirst) t(page, 'ABN: 17 007 048 008', ML, y - logoH - 10, reg, 9, DARK)
    y -= logoH + 22
    drawHLine(page, ML, y, CW, 1, DARK)

    if (isFirst) {
      y -= 20
      t(page, input.senderName    ?? 'NBE AUSTRALIA',                                      ML, y,      bold, 8, DARK)
      t(page, input.senderAddress ?? '22A Humeside Dr, Campbellfield VIC 3061, Australia', ML, y - 12, reg,  8, DARK)
      t(page, input.senderEmail   ?? 'accountsreceivable@nbeaustralia.com.au',             ML, y - 24, reg,  8, DARK)
      t(page, input.contactName   ?? 'Andrew Newton',                                      ML, y - 36, reg,  8, DARK)
      t(page, input.contactPhone  ?? '(04) 2705 5556',                                     ML, y - 48, reg,  8, DARK)
      t(page, input.contactEmail  ?? 'anewton@nbeaustralia.com.au',                        ML, y - 60, reg,  8, DARK)
      const dateLabelX = ML + CW - 160
      const dateRows: [string, string][] = [
        ['DATE',        input.date],
        ['VALID UNTIL', input.validUntil],
        ['QUOTE NO.',   input.quoteNumber],
      ]
      dateRows.forEach(([label, val], i) => {
        t(page,      label, dateLabelX, y - i * 14, bold, 8.5, DARK)
        tRight(page, val,   ML + CW,    y - i * 14, reg,  8.5, DARK)
      })
      y -= 80
      const STRIP_H = 20
      drawRect(page, ML, y - STRIP_H, CW, STRIP_H, BLACK)
      t(page, 'CUSTOMER', ML + 8, y - 13, bold, 10, WHITE)
      y -= STRIP_H + 12
      const custRows: [string, string][] = [
        ['Customer',  input.customerName     || ''],
        ['Attention', input.customerAttn     || ''],
        ['Address',   input.customerAddress  || ''],
        ['Postcode',  input.customerPostcode || ''],
        ['Phone',     input.customerPhone    || ''],
        ['Email',     input.customerEmail    || ''],
      ]
      custRows.forEach(([label, val], i) => {
        t(page, label, ML + 4,  y - i * 14, bold, 8, CUST_COLOR)
        t(page, val,   ML + 80, y - i * 14, reg,  8, CUST_COLOR)
      })
      y -= custRows.length * 14 + 16
    } else {
      y -= 14
    }

    drawTableHeader()
  }

  startPage(true)

  // ── Draw door rows ────────────────────────────────────────────────────────────
  for (const rd of doorRows) {
    if (y - rd.rowH < SAFE_BOTTOM) startPage(false)
    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))
    const total = rd.door.qty * rd.door.unitPrice
    const textY = y - 10
    t(page,       String(rd.idx + 1),       cNo + 2,  textY, reg, 9, BLACK)
    t(page,       rd.door.item,             cItem,    textY, bold, 9, BLACK)
    rd.descLines.forEach((ln, li) => {
      t(page, ln, cDesc, textY - li * DESC_LINE_H, reg, 7.5, DARK)
    })
    tCenter(page, String(rd.door.qty),      cQtyX, cQtyW, textY, reg, 9, BLACK)
    tRight(page,  fmtAUD(rd.door.unitPrice), cUpRight,    textY, reg, 9, BLACK)
    tRight(page,  fmtAUD(total),             cTotRight,   textY, reg, 9, BLACK)
    y -= rd.rowH
  }

  // ── Delivery / Installation extra rows ────────────────────────────────────────
  let extraIdx = input.doors.length + 1
  if (instN > 0) {
    if (y - FILLER_ROW_H < SAFE_BOTTOM) startPage(false)
    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))
    t(page,       String(extraIdx), cNo + 2, y - 10, reg, 9, BLACK)
    t(page,       'Installation',   cItem,   y - 10, reg, 9, BLACK)
    tCenter(page, '1', cQtyX, cQtyW, y - 10, reg, 9, BLACK)
    tRight(page,  fmtAUD(instN), cUpRight,  y - 10, reg, 9, BLACK)
    tRight(page,  fmtAUD(instN), cTotRight, y - 10, reg, 9, BLACK)
    y -= FILLER_ROW_H
    extraIdx++
  }
  if (delivN > 0) {
    if (y - FILLER_ROW_H < SAFE_BOTTOM) startPage(false)
    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))
    t(page,       String(extraIdx), cNo + 2, y - 10, reg, 9, BLACK)
    t(page,       'Delivery',       cItem,   y - 10, reg, 9, BLACK)
    tCenter(page, '1', cQtyX, cQtyW, y - 10, reg, 9, BLACK)
    tRight(page,  fmtAUD(delivN), cUpRight,  y - 10, reg, 9, BLACK)
    tRight(page,  fmtAUD(delivN), cTotRight, y - 10, reg, 9, BLACK)
    y -= FILLER_ROW_H
  }

  for (let i = 0; i < fillerCount; i++) {
    if (y - FILLER_ROW_H < SAFE_BOTTOM) startPage(false)
    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))
    y -= FILLER_ROW_H
  }
  drawHLine(page, ML, y, CW, 0.8, DARK)
  y -= 16

  if (y < MIN_Y_FOR_TOTALS) startPage(false)

  // ── Totals + bank details ─────────────────────────────────────────────────────
  const doorsSubtotal = input.doors.reduce((s, d) => s + d.qty * d.unitPrice, 0)
  const grandTotal    = doorsSubtotal + delivN + instN
  const discPct       = input.discountPct ?? 0
  const bankY = y

  t(page, 'BANK DETAILS',                             ML, bankY - 14, bold, 8, DARK)
  t(page, 'Account Name: NBE Australia Pty Ltd',      ML, bankY - 26, reg,  8, DARK)
  t(page, 'BSB: 013-525  |  Account No.: 3473-93755', ML, bankY - 38, reg,  8, DARK)

  if (discPct > 0) {
    t(page, `${discPct}% material discount applied to PVC strip & headrail`, ML, bankY - 52, italic, 7.5, PVC_COLOR)
  }

  const totBoxW     = 170
  const totValRight = ML + CW
  const totLabelX   = ML + CW - totBoxW + 8

  t(page,      'Subtotal',   totLabelX,    bankY,      reg, 9, DARK)
  tRight(page, grandTotal > 0 ? fmtAUD(grandTotal) : '-',       totValRight, bankY,      reg, 9, DARK)
  t(page,      'GST (10%)',  totLabelX,    bankY - 14, reg, 9, DARK)
  tRight(page, grandTotal > 0 ? fmtAUD(grandTotal * 0.1) : '-', totValRight, bankY - 14, reg, 9, DARK)

  const totBoxY = bankY - 48
  drawRect(page, ML + CW - totBoxW, totBoxY, totBoxW, 22, BLACK)
  t(page,      'TOTAL',  ML + CW - totBoxW + 8, totBoxY + 6, bold, 10, WHITE)
  tRight(page, grandTotal > 0 ? fmtAUD(grandTotal * 1.1) : '$  -', ML + CW - 4, totBoxY + 6, bold, 10, WHITE)

  footerLines.forEach((ln, i) => {
    t(page, ln, ML, footerStartY - i * footerLineH, italic, footerSize, footerColor)
  })
  drawPageFooterBar()

  // ── Append T&C pages ─────────────────────────────────────────────────────────
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
      const pages   = await pdfDoc.copyPages(tcDoc, tcDoc.getPageIndices())
      pages.forEach(p => pdfDoc.addPage(p))
    } catch {}
  }

  const safeCust = (input.customerName || 'CUSTOMER')
    .replace(/[^a-zA-Z0-9\s]/g, ' ').trim().replace(/\s+/g, '_').slice(0, 50)
  const euPart = input.endUser ? `_${input.endUser}` : ''
  pdfDoc.setTitle(`${input.quoteNumber}_${safeCust}${euPart}`)

  return pdfDoc.save()
}
