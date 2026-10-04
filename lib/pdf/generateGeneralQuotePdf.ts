import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'
import { parseRichDesc, drawRichLine, type RichLine } from '@/lib/pdf/richText'

const BRAND = rgb(0.282, 0.067, 0.749)   // #4811BF
const DARK  = rgb(0.08,  0.08,  0.08)
const GREY  = rgb(0.40,  0.40,  0.40)
const WHITE = rgb(1,     1,     1)
const BLACK = rgb(0,     0,     0)

export type GeneralNoteStyle = { bold?: boolean; italic?: boolean; color?: string; bgColor?: string; fontSize?: string }

export type GeneralLineItem = {
  item:         string
  description?: string
  width?:       string
  height?:      string
  qty:          number
  unitPrice:    number
  notes?:       string
  noteStyle?:   GeneralNoteStyle
  extras?:      Record<string, string>
}

export type GeneralColSpec = { key: string; label: string; width?: number }

export type GeneralQuotePdfInput = {
  quoteNumber:      string
  date:             string
  validUntil:       string
  customerName:     string
  customerAttn:     string
  customerAddress:  string
  customerPostcode: string
  customerPhone:    string
  customerEmail:    string
  lineItems:        GeneralLineItem[]
  visibleColumns?:  GeneralColSpec[]
  discountPct?:     number
  discountColor?:   string
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
    if (font.widthOfTextAtSize(test, size) <= maxWidth) { line = test }
    else { if (line) lines.push(line); line = word }
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

export async function generateGeneralQuotePdf(input: GeneralQuotePdfInput): Promise<Uint8Array> {
  const pdfDoc    = await PDFDocument.create()
  const roboto    = await embedRobotoForPdfLib(pdfDoc)
  const jostLight = await embedDisplayFont(pdfDoc)
  const reg       = roboto?.regular ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))
  const bold      = roboto?.bold    ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
  const italic    = roboto?.italic  ?? (await pdfDoc.embedFont(StandardFonts.HelveticaOblique))
  const display: import('pdf-lib').PDFFont = jostLight ?? reg

  const PW = 595.28, ML = 36, MR = 36, CW = PW - ML - MR
  const sanitise = safeText

  // ── Column geometry ───────────────────────────────────────────────────────────
  const DEFAULT_COLS: GeneralColSpec[] = [
    { key: 'sno', label: 'S.No' }, { key: 'item', label: 'Item' },
    { key: 'description', label: 'Description' }, { key: 'width', label: 'Width' },
    { key: 'height', label: 'Height' }, { key: 'qty', label: 'Qty' },
    { key: 'unitPrice', label: 'Unit Price' }, { key: 'total', label: 'Total' },
  ]
  const visCols   = input.visibleColumns ?? DEFAULT_COLS
  const FIXED_W: Record<string, number> = { sno: 22, item: 80, width: 42, height: 42, qty: 28, unitPrice: 65, total: 65 }
  const EXTRA_W   = 55

  const allHaveWidth = visCols.every(c => c.width != null)
  let rawWidths: number[]
  if (allHaveWidth) {
    const rawTotal = visCols.reduce((s, c) => s + c.width!, 0)
    const scale = CW / rawTotal
    rawWidths = visCols.map(c => Math.max(16, c.width! * scale))
  } else {
    const fixedTotal    = visCols.reduce((s, c) => c.key === 'description' ? s : s + (FIXED_W[c.key] ?? EXTRA_W), 0)
    const fallbackDescW = visCols.some(c => c.key === 'description') ? Math.max(60, CW - fixedTotal) : 0
    rawWidths = visCols.map(c => c.key === 'description' ? fallbackDescW : (FIXED_W[c.key] ?? EXTRA_W))
  }

  type ColGeo = { key: string; label: string; x: number; w: number; align: 'left' | 'center' | 'right' }
  const cols: ColGeo[] = []
  let colX = ML
  for (let ci = 0; ci < visCols.length; ci++) {
    const c = visCols[ci], w = rawWidths[ci]
    const align: 'left' | 'center' | 'right' =
      c.key === 'unitPrice' || c.key === 'total' ? 'right' :
      c.key === 'sno' || c.key === 'description' || c.key === 'item' ? 'left' : 'center'
    cols.push({ key: c.key, label: c.label, x: colX, w, align })
    colX += w
  }

  const TH = 20, SH = 14
  const ROW_H = 18, LINE_H = 11
  const descCol   = cols.find(c => c.key === 'description')
  const hasDesc   = descCol != null
  const descW     = descCol ? descCol.w - 8 : 100
  const SH_LABELS: Record<string, string> = { sno: '#', width: 'WIDTH', height: 'HEIGHT', qty: '#', unitPrice: '$', total: '$$' }
  const hasSubRow = cols.some(c => SH_LABELS[c.key] != null)

  // ── Pre-compute row data ──────────────────────────────────────────────────────
  type RowData = {
    item: GeneralLineItem; idx: number; rowTotal: number
    richLines: RichLine[]; rowH: number; noteLines: string[]; noteH: number
  }
  const filledItems = input.lineItems.filter(it => it.item.trim() || it.unitPrice > 0)
  const rowData: RowData[] = filledItems.map((item, i) => {
    const rowTotal  = item.qty * item.unitPrice
    const richLines = hasDesc && item.description?.trim()
      ? parseRichDesc(item.description, { reg, bold, italic }, 9, descW)
      : []
    const rowH      = richLines.length > 1 ? richLines.length * LINE_H + 8 : ROW_H
    const noteLines = item.notes?.trim() ? wrapText(sanitise(item.notes), reg, 8.5, CW - 24) : []
    const noteH     = noteLines.length > 0 ? noteLines.length * 10 + 8 : 0
    return { item, idx: i, rowTotal, richLines, rowH, noteLines, noteH }
  })
  const MIN_ROWS = Math.max(filledItems.length + 3, 5)

  // ── Footer terms ─────────────────────────────────────────────────────────────
  const DEFAULT_TERMS = 'This quotation is based on the NBE Standard Door comprising a galvanized frame, PVC curtain (900 g/m\xB2), and a zinc-coated control box (RAL 7035). Optional extras (e.g. powder coating, light curtain, remote control, radar, traffic light, induction loop, contactless exit button) are available at additional cost. All other matters shall be subject to our standard Terms and Conditions (T&C). The electrical scope is limited to the connection between the control panel and the doors only. Power supply and isolator shall be provided by others.'
  const terms       = safeText(input.terms?.trim() || DEFAULT_TERMS)
  const footerSize  = 8, footerLineH = 11
  const footerColor = rgb(0x33/255, 0x33/255, 0x33/255)
  const footerLines = wrapText(terms, italic, footerSize, CW)
  const footerStartY = 52 + (footerLines.length - 1) * footerLineH

  // ── Pagination simulation ─────────────────────────────────────────────────────
  const discPct          = input.discountPct ?? 0
  const SAFE_BOTTOM      = 50
  const Y_ROWS_P1        = 460
  const Y_ROWS_CONT      = 678
  const TOTALS_ROWS      = 2 + (discPct > 0 ? 1 : 0)
  const TOTALS_NEEDED    = TOTALS_ROWS * 16 + 34
  const MIN_Y_FOR_TOTALS = footerStartY + TOTALS_NEEDED + 24

  const simulateTotalPages = (): number => {
    let simY = Y_ROWS_P1, pages = 1
    for (const rd of rowData) {
      if (simY - rd.noteH - rd.rowH < SAFE_BOTTOM) { pages++; simY = Y_ROWS_CONT }
      simY -= rd.noteH + rd.rowH
    }
    const fillerCount = Math.max(0, MIN_ROWS - rowData.length)
    for (let i = 0; i < fillerCount; i++) {
      if (simY - ROW_H < SAFE_BOTTOM) { pages++; simY = Y_ROWS_CONT }
      simY -= ROW_H
    }
    simY -= 18
    if (simY < MIN_Y_FOR_TOTALS) pages++
    return pages
  }
  const totalPages = simulateTotalPages()

  // ── Rendering state ───────────────────────────────────────────────────────────
  let page: PDFPage = null!
  let y = 800
  let pageNum = 0

  let logoImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'NBE_LOGO_BK_PL.png'))
    logoImg = await pdfDoc.embedPng(new Uint8Array(logoBytes))
  } catch {}

  const drawTableCols = () => {
    drawRect(page, ML, y - TH, CW, TH, BLACK)
    cols.forEach(col => {
      const label = col.key === 'sno' ? 'NO' : col.key === 'unitPrice' ? 'UNIT PRICE' : col.label.toUpperCase()
      if (col.align === 'right')       tRight (page, label, col.x + col.w - 4, y - 13, bold, 8, WHITE)
      else if (col.align === 'center') tCenter(page, label, col.x, col.w, y - 13, bold, 8, WHITE)
      else                             t      (page, label, col.x + (col.key === 'sno' ? 2 : 0), y - 13, bold, 8, WHITE)
    })
    y -= TH
    if (hasSubRow) {
      cols.forEach(col => {
        const sub = SH_LABELS[col.key]; if (!sub) return
        if (col.align === 'right')       tRight (page, sub, col.x + col.w - 4, y - 9, reg, 8, BLACK)
        else if (col.align === 'center') tCenter(page, sub, col.x, col.w, y - 9, reg, 8, BLACK)
        else                             t      (page, sub, col.x + 2, y - 9, reg, 8, BLACK)
      })
      y -= SH
    }
    drawHLine(page, ML, y, CW, 1.2, DARK)
    y -= 2
  }

  const drawPageFooterBar = () => {
    drawHLine(page, ML, 38, CW, 0.5, DARK)
    t(page, 'NBE AUSTRALIA',       ML,      20, bold, 7.5, DARK)
    t(page, 'nbeaustralia.com.au', ML + 75, 20, reg,  7,   GREY)
    tRight(page, `Quote No. ${input.quoteNumber} | GENERAL | Page ${pageNum} of ${totalPages}`, ML + CW, 20, reg, 7.5, GREY)
  }

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
    t(page, 'GENERAL', PW - MR - bold.widthOfTextAtSize('GENERAL', 14), y - 52, bold, 14, BRAND)
    if (isFirst) t(page, 'ABN: 17 007 048 008', ML, y - logoH - 10, reg, 9, DARK)
    y -= logoH + 22
    drawHLine(page, ML, y, CW, 1, DARK)

    if (isFirst) {
      y -= 20
      // Company info + date block
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
      // Customer section
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
      const CUST_COLOR = rgb(31/255, 41/255, 51/255)
      custRows.forEach(([label, val], i) => {
        t(page, label, ML + 4,  y - i * 14, bold, 8, CUST_COLOR)
        t(page, val,   ML + 80, y - i * 14, reg,  8, CUST_COLOR)
      })
      y -= custRows.length * 14 + 16
    } else {
      y -= 14
    }

    drawTableCols()
  }

  // ── Start page 1 ─────────────────────────────────────────────────────────────
  startPage(true)

  // ── Draw rows ─────────────────────────────────────────────────────────────────
  const parseHex = (hex: string) => {
    const m = hex.replace('#', '').match(/.{2}/g)
    return m ? rgb(parseInt(m[0], 16) / 255, parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255) : null
  }

  let rowsDrawn = 0
  for (const rd of rowData) {
    const rowTotal = rd.noteH + rd.rowH
    if (y - rowTotal < SAFE_BOTTOM) startPage(false)

    if (rd.noteH > 0) {
      const noteBg = rd.item.noteStyle?.bgColor ? (parseHex(rd.item.noteStyle.bgColor) ?? rgb(0.93, 0.95, 1)) : rgb(0.93, 0.95, 1)
      const noteFg = rd.item.noteStyle?.color   ? (parseHex(rd.item.noteStyle.color)   ?? GREY)               : GREY
      page.drawRectangle({ x: ML, y: y - rd.noteH + 2, width: CW, height: rd.noteH, color: noteBg })
      rd.noteLines.forEach((line, li) => t(page, line, ML + 8, y - 9 - li * 10, reg, 8.5, noteFg))
      y -= rd.noteH
    }

    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))

    cols.forEach(col => {
      let val = ''
      switch (col.key) {
        case 'sno':         val = String(rd.idx + 1); break
        case 'item':        val = sanitise(rd.item.item); break
        case 'width':       val = sanitise(rd.item.width ?? ''); break
        case 'height':      val = sanitise(rd.item.height ?? ''); break
        case 'qty':         val = String(rd.item.qty); break
        case 'unitPrice':   val = rd.item.unitPrice > 0 ? fmtAUD(rd.item.unitPrice) : '-'; break
        case 'total':       val = rd.rowTotal > 0 ? fmtAUD(rd.rowTotal) : '-'; break
        case 'description': {
          rd.richLines.forEach((line, li) => {
            drawRichLine(page, line, col.x, y - 12 - li * LINE_H, { reg, bold, italic }, 9, BLACK)
          })
          return
        }
        default: val = sanitise(rd.item.extras?.[col.key] ?? ''); break
      }
      if (col.align === 'right')       tRight (page, val, col.x + col.w - 4, y - 12, reg, 10, BLACK)
      else if (col.align === 'center') tCenter(page, val, col.x, col.w, y - 12, reg, 10, BLACK)
      else                             t      (page, val, col.x + (col.key === 'sno' ? 2 : 0), y - 12, reg, 10, BLACK)
    })

    y -= rd.rowH
    rowsDrawn++
  }

  const fillerCount = Math.max(0, MIN_ROWS - rowsDrawn)
  for (let i = 0; i < fillerCount; i++) {
    if (y - ROW_H < SAFE_BOTTOM) startPage(false)
    drawHLine(page, ML, y, CW, 0.3, rgb(0.82, 0.82, 0.82))
    y -= ROW_H
  }
  drawHLine(page, ML, y, CW, 0.8, DARK)
  y -= 16

  if (y < MIN_Y_FOR_TOTALS) startPage(false)

  // ── Totals + bank details ─────────────────────────────────────────────────────
  const grandTotal = filledItems.reduce((s, it) => s + it.qty * it.unitPrice, 0)
  const afterDisc  = grandTotal * (1 - discPct / 100)
  const bankY = y

  t(page, 'BANK DETAILS',                             ML, bankY - 14, bold, 8, DARK)
  t(page, 'Account Name: NBE Australia Pty Ltd',      ML, bankY - 26, reg,  8, DARK)
  t(page, 'BSB: 013-525  |  Account No.: 3473-93755', ML, bankY - 38, reg,  8, DARK)

  const totBoxW     = 170
  const totValRight = ML + CW
  const totLabelX   = ML + CW - totBoxW + 8
  const ROW_STEP    = 16
  const hexToRgb = (hex: string) => {
    const m = hex.replace('#', '').match(/.{2}/g)
    return m ? rgb(parseInt(m[0], 16) / 255, parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255) : rgb(0, 0.45, 0.1)
  }
  const DISC_COLOR = input.discountColor ? hexToRgb(input.discountColor) : rgb(0, 0.45, 0.1)

  t(page,      'Subtotal',                                     totLabelX,   bankY,            reg, 9, DARK)
  tRight(page, grandTotal > 0 ? fmtAUD(grandTotal) : '-',     totValRight, bankY,            reg, 9, DARK)

  let offsetY = ROW_STEP
  if (discPct > 0) {
    const saving = grandTotal * discPct / 100
    t(page,      `Discount (${discPct}%)`,                     totLabelX,   bankY - offsetY,  reg, 9, DISC_COLOR)
    tRight(page, `-${fmtAUD(saving)}`,                         totValRight, bankY - offsetY,  reg, 9, DISC_COLOR)
    offsetY += ROW_STEP
  }
  t(page,      'GST (10%)',                                    totLabelX,   bankY - offsetY,  reg, 9, DARK)
  tRight(page, afterDisc > 0 ? fmtAUD(afterDisc * 0.1) : '-', totValRight, bankY - offsetY,  reg, 9, DARK)
  offsetY += ROW_STEP

  const totBoxY = bankY - offsetY - 10
  drawRect(page, ML + CW - totBoxW, totBoxY, totBoxW, 24, BLACK)
  t(page,      'TOTAL',                                        ML + CW - totBoxW + 8, totBoxY + 7, bold, 10, WHITE)
  tRight(page, afterDisc > 0 ? fmtAUD(afterDisc * 1.1) : '$  -', ML + CW - 4,       totBoxY + 7, bold, 10, WHITE)

  footerLines.forEach((ln, i) => {
    t(page, ln, ML, footerStartY - i * footerLineH, italic, footerSize, footerColor)
  })
  drawPageFooterBar()

  // ── T&C pages ─────────────────────────────────────────────────────────────────
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

  const safeCust = (input.customerName || 'CUSTOMER').replace(/[^a-zA-Z0-9\s]/g, ' ').trim().replace(/\s+/g, '_').slice(0, 50)
  const euPart = input.endUser ? `_${input.endUser}` : ''
  pdfDoc.setTitle(`${input.quoteNumber}_${safeCust}${euPart}`)

  return pdfDoc.save()
}
