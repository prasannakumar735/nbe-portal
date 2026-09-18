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

  const page = pdfDoc.addPage([595.28, 841.89])
  const PW = 595.28
  const ML = 36, MR = 36, CW = PW - ML - MR
  let y = 800

  // ── HEADER ─────────────────────────────────────────────────────────────────
  const logoH = 50
  let logoImg = null
  try {
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'NBE_LOGO_BK_PL.png'))
    logoImg = await pdfDoc.embedPng(new Uint8Array(logoBytes))
  } catch { /* fallback text */ }

  if (logoImg) {
    const { width: lw, height: lh } = logoImg
    page.drawImage(logoImg, { x: ML, y: y - logoH, width: (lw / lh) * logoH, height: logoH })
  } else {
    t(page, 'NBE australia', ML, y - 22, bold, 20, BLACK)
  }
  t(page, 'ABN: 17 007 048 008', ML, y - logoH - 10, reg, 9, DARK)

  t(page, 'QUOTE', PW - MR - display.widthOfTextAtSize('QUOTE', 36), y - 26, display, 36, BLACK)

  const subtitle = 'PVC FLEX SYSTEMS'
  t(page, subtitle, PW - MR - bold.widthOfTextAtSize(subtitle, 14), y - 52, bold, 14, PVC_COLOR)

  y -= logoH + 22
  drawHLine(page, ML, y, CW, 1, DARK)
  y -= 20

  // ── COMPANY INFO + DATE BLOCK ───────────────────────────────────────────────
  const CUST_COLOR = rgb(31 / 255, 41 / 255, 51 / 255)

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

  // ── CUSTOMER SECTION ────────────────────────────────────────────────────────
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
  const cLabelX = ML + 4
  const cValueX = ML + 80
  custRows.forEach(([label, val], i) => {
    t(page, label, cLabelX, y - i * 14, bold, 8, CUST_COLOR)
    t(page, val,   cValueX, y - i * 14, reg,  8, CUST_COLOR)
  })
  y -= custRows.length * 14 + 16

  // ── LINE ITEMS TABLE ────────────────────────────────────────────────────────
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

  // Header bar
  const TH = 20
  drawRect(page, ML, y - TH, CW, TH, BLACK)
  t(page,       'NO',          cNo + 2,   y - 13, bold, 8, WHITE)
  t(page,       'ITEM',        cItem,     y - 13, bold, 8, WHITE)
  tCenter(page, 'DESCRIPTION', cDesc, cDescW, y - 13, bold, 8, WHITE)
  tCenter(page, 'QTY',         cQtyX,    cQtyW, y - 13, bold, 8, WHITE)
  tRight(page,  'UNIT PRICE',  cUpRight,         y - 13, bold, 8, WHITE)
  tRight(page,  'TOTAL',       cTotRight - 4,    y - 13, bold, 8, WHITE)
  y -= TH

  // Sub-header
  const SH = 14
  t(page,      '#',  cNo + 2,  y - 9, reg, 8, BLACK)
  tCenter(page, '#', cQtyX, cQtyW, y - 9, reg, 8, BLACK)
  tRight(page,  '$',  cUpRight,      y - 9, reg, 8, BLACK)
  tRight(page,  '$$', cTotRight - 4, y - 9, reg, 8, BLACK)
  y -= SH
  drawHLine(page, ML, y, CW, 1.2, DARK)
  y -= 2

  const BASE_ROW_H  = 14
  const DESC_LINE_H = 11

  // Door rows
  input.doors.forEach((door, i) => {
    const descLines = door.description.split('\n').filter(Boolean)
    const rowH = Math.max(BASE_ROW_H, descLines.length * DESC_LINE_H + 8)
    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))
    const total = door.qty * door.unitPrice

    const textY = y - 10
    t(page,       String(i + 1),  cNo + 2,  textY, reg, 9, BLACK)
    t(page,       door.item,      cItem,    textY, bold, 9, BLACK)
    descLines.forEach((ln, li) => {
      t(page, ln, cDesc, textY - li * DESC_LINE_H, reg, 7.5, DARK)
    })
    tCenter(page, String(door.qty), cQtyX, cQtyW, textY, reg, 9, BLACK)
    tRight(page,  fmtAUD(door.unitPrice), cUpRight,    textY, reg, 9, BLACK)
    tRight(page,  fmtAUD(total),          cTotRight,   textY, reg, 9, BLACK)
    y -= rowH
  })

  // Delivery / Installation as additional rows
  const doorsSubtotal = input.doors.reduce((s, d) => s + d.qty * d.unitPrice, 0)
  const delivN = input.delivery    ?? 0
  const instN  = input.installation ?? 0

  if (instN > 0) {
    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))
    t(page, `${input.doors.length + 1}`, cNo + 2, y - 10, reg, 9, BLACK)
    t(page, 'Installation', cItem, y - 10, reg, 9, BLACK)
    tCenter(page, '1', cQtyX, cQtyW, y - 10, reg, 9, BLACK)
    tRight(page, fmtAUD(instN), cUpRight,    y - 10, reg, 9, BLACK)
    tRight(page, fmtAUD(instN), cTotRight,   y - 10, reg, 9, BLACK)
    y -= BASE_ROW_H + 4
  }
  if (delivN > 0) {
    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))
    t(page, `${input.doors.length + (instN > 0 ? 2 : 1)}`, cNo + 2, y - 10, reg, 9, BLACK)
    t(page, 'Delivery', cItem, y - 10, reg, 9, BLACK)
    tCenter(page, '1', cQtyX, cQtyW, y - 10, reg, 9, BLACK)
    tRight(page, fmtAUD(delivN), cUpRight,    y - 10, reg, 9, BLACK)
    tRight(page, fmtAUD(delivN), cTotRight,   y - 10, reg, 9, BLACK)
    y -= BASE_ROW_H + 4
  }

  // Empty filler rows (min 6 total visible lines)
  const MIN_ROWS = 8
  const usedRows = input.doors.length + (instN > 0 ? 1 : 0) + (delivN > 0 ? 1 : 0)
  for (let i = 0; i < Math.max(0, MIN_ROWS - usedRows); i++) {
    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))
    y -= BASE_ROW_H + 4
  }
  drawHLine(page, ML, y, CW, 0.8, DARK)
  y -= 16

  // ── TOTALS + BANK DETAILS ──────────────────────────────────────────────────
  const grandTotal = doorsSubtotal + delivN + instN
  const bankY = y

  t(page, 'BANK DETAILS',                             ML, bankY - 14, bold, 8, DARK)
  t(page, 'Account Name: NBE Australia Pty Ltd',      ML, bankY - 26, reg,  8, DARK)
  t(page, 'BSB: 013-525  |  Account No.: 3473-93755', ML, bankY - 38, reg,  8, DARK)

  // Discount note
  const discPct = input.discountPct ?? 0
  if (discPct > 0) {
    t(page, `${discPct}% material discount applied to PVC strip & headrail`, ML, bankY - 52, italic, 7.5, PVC_COLOR)
  }

  const totBoxW    = 170
  const totValRight = ML + CW
  const totLabelX  = ML + CW - totBoxW + 8

  t(page,      'Subtotal',              totLabelX,    bankY,      reg, 9, DARK)
  tRight(page, grandTotal > 0 ? fmtAUD(grandTotal) : '-', totValRight, bankY, reg, 9, DARK)
  t(page,      'GST (10%)',             totLabelX,    bankY - 14, reg, 9, DARK)
  tRight(page, grandTotal > 0 ? fmtAUD(grandTotal * 0.1) : '-', totValRight, bankY - 14, reg, 9, DARK)

  const totBoxY = bankY - 48
  drawRect(page, ML + CW - totBoxW, totBoxY, totBoxW, 22, BLACK)
  t(page,      'TOTAL',  ML + CW - totBoxW + 8, totBoxY + 6, bold, 10, WHITE)
  tRight(page, grandTotal > 0 ? fmtAUD(grandTotal * 1.1) : '$  -', ML + CW - 4, totBoxY + 6, bold, 10, WHITE)

  // ── FOOTER TERMS ────────────────────────────────────────────────────────────
  const DEFAULT_TERMS = 'This quotation covers the PVC strip curtain system(s) listed above. Strip configurations are calculated from nominated opening dimensions; final measurements must be verified on-site before manufacture. Pricing is valid for 30 days from date of issue. Delivery and installation are excluded unless shown as priced line items. All supply and installation is subject to NBE Australia\'s standard Terms & Conditions.'
  const terms = input.terms?.trim() || DEFAULT_TERMS
  const footerLines  = wrapText(terms, italic, 8, CW)
  const footerLineH  = 11
  const footerStartY = 52 + (footerLines.length - 1) * footerLineH
  footerLines.forEach((ln, i) => {
    page.drawText(ln, { x: ML, y: footerStartY - i * footerLineH, size: 8, font: italic, color: rgb(0x33/255, 0x33/255, 0x33/255) })
  })

  // ── PAGE FOOTER BAR ─────────────────────────────────────────────────────────
  drawHLine(page, ML, 38, CW, 0.5, DARK)
  t(page, 'NBE AUSTRALIA',       ML,       20, bold, 7.5, DARK)
  t(page, 'nbeaustralia.com.au', ML + 75,  20, reg,  7,   GREY)
  tRight(page, `Quote No. ${input.quoteNumber} | PVC FLEX SYSTEMS | Page 1 of 1`, ML + CW, 20, reg, 7.5, GREY)

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
    } catch { /* T&C file missing — skip silently */ }
  }

  const safeCust = (input.customerName || 'CUSTOMER')
    .replace(/[^a-zA-Z0-9\s]/g, ' ').trim().replace(/\s+/g, '_').slice(0, 50)
  const euPart = input.endUser ? `_${input.endUser}` : ''
  pdfDoc.setTitle(`${input.quoteNumber}_${safeCust}${euPart}`)

  return pdfDoc.save()
}
