import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'

// ── Colours ───────────────────────────────────────────────────────────────────
const NAVY    = rgb(0.08, 0.18, 0.35)
const AMBER   = rgb(1.00, 0.95, 0.80)
const WHITE   = rgb(1,    1,    1)
const BLACK   = rgb(0,    0,    0)
const DKGRAY  = rgb(0.25, 0.25, 0.25)
const LTGRAY  = rgb(0.93, 0.93, 0.93)
const MIDGRAY = rgb(0.75, 0.75, 0.75)
const BORDER  = rgb(0.82, 0.82, 0.82)

export type ServicePvcJobCardDoor = {
  label:        string
  materialType: string   // "Standard" | "Coolroom"
  profile:      string
  stripSizeMm:  number
  thicknessMm:  number
  stripLengthMm: number
  stripCount:   number
  application:  string
  rivetsHangers: string
  doorWidthMm:  number
  doorHeightMm: number
  headrail:     string
  qty:          number
}

export type ServicePvcJobCardInput = {
  jobCardNumber:   string
  quoteNumber:     string
  status:          string
  assignedToName:  string
  poReference:     string | null
  jobName:         string
  createdDate:     string
  requiredBy:      string
  customerName:    string
  siteContact:     string | null
  siteAddress:     string | null
  customerReference: string | null
  importantNote:   string | null
  doors:           ServicePvcJobCardDoor[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color = BORDER) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })
}

function rect(page: PDFPage, x: number, y: number, w: number, h: number, color = LTGRAY) {
  page.drawRectangle({ x, y, width: w, height: h, color })
}

function t(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BLACK,
  maxWidth?: number,
) {
  const s = String(text ?? '')
  if (!s) return
  const opts: Parameters<typeof page.drawText>[1] = { x, y, size, font, color }
  if (maxWidth) opts.maxWidth = maxWidth
  page.drawText(s, opts)
}

function sectionHeader(
  page: PDFPage,
  label: string,
  x: number, y: number, w: number, h: number,
  bold: PDFFont, size = 8,
) {
  rect(page, x, y - h, w, h, NAVY)
  t(page, label, x + 6, y - h + (h - size) / 2 + 1, bold, size, WHITE)
  return y - h
}

function labelValue(
  page: PDFPage,
  label: string, value: string | null | undefined,
  x: number, y: number,
  small: PDFFont, bold: PDFFont,
  colW: number,
  maxW?: number,
) {
  t(page, label.toUpperCase(), x, y + 10, small, 6, DKGRAY)
  t(page, value ?? '—', x, y, bold, 8.5, BLACK, maxW ?? colW - 6)
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateServicePvcJobCardPdf(input: ServicePvcJobCardInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const roboto = await embedRobotoForPdfLib(pdfDoc)
  const reg    = roboto?.regular ?? (await pdfDoc.embedFont(StandardFonts.Helvetica))
  const bold   = roboto?.bold    ?? (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
  const small  = reg

  const PW = 595.28
  const PH = 841.89
  const ML = 28
  const MR = 28
  const CW = PW - ML - MR

  const page = pdfDoc.addPage([PW, PH])

  // ── Logo ─────────────────────────────────────────────────────────────────────
  let logoImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'NBE_LOGO_BK_PL.png'))
    logoImg = await pdfDoc.embedPng(new Uint8Array(logoBytes))
  } catch { /* skip */ }

  let y = PH - 22
  const logoH = 44
  if (logoImg) {
    const logoW = logoImg.width * (logoH / logoImg.height)
    page.drawImage(logoImg, { x: ML, y: y - logoH, width: logoW, height: logoH })
  }

  t(page, 'PVC STRIP CURTAIN', ML + CW / 2 - 10, y - 14, bold, 18, NAVY)
  t(page, 'MANUFACTURING JOB CARD', ML + CW / 2 - 10, y - 28, reg, 8, DKGRAY)

  y -= logoH + 6
  t(page, '22A Humeside Drive, Campbellfield VIC 3061  •  Ph: 03 9357 5858', ML, y, small, 7, DKGRAY)
  line(page, ML, y - 4, ML + CW, y - 4, 1, MIDGRAY)
  y -= 10

  // ── JOB DETAILS ──────────────────────────────────────────────────────────────
  const secH = 13
  y = sectionHeader(page, 'JOB DETAILS', ML, y, CW, secH, bold)

  rect(page, ML, y - 26, CW, 26, LTGRAY)
  line(page, ML, y - 26, ML + CW, y - 26, 0.3, BORDER)
  const col4 = CW / 4
  labelValue(page, 'Job Card',    input.jobCardNumber,    ML + 4,          y - 9,  small, bold, col4)
  labelValue(page, 'Quote',       input.quoteNumber,      ML + 4 + col4,   y - 9,  small, bold, col4)
  labelValue(page, 'Status',      input.status,           ML + 4 + col4*2, y - 9,  small, bold, col4)
  labelValue(page, 'Assigned To', input.assignedToName,   ML + 4 + col4*3, y - 9,  small, bold, col4)
  y -= 26

  rect(page, ML, y - 26, CW, 26, WHITE)
  line(page, ML, y - 26, ML + CW, y - 26, 0.3, BORDER)
  labelValue(page, 'PO / Customer Ref.', input.poReference,   ML + 4,          y - 9,  small, bold, col4)
  labelValue(page, 'Job Name',           input.jobName,        ML + 4 + col4,   y - 9,  small, bold, col4 * 2 - 4)
  labelValue(page, 'Created',            input.createdDate,    ML + 4 + col4*3, y - 9,  small, bold, col4)
  y -= 26

  rect(page, ML, y - 20, CW, 20, LTGRAY)
  line(page, ML, y - 20, ML + CW, y - 20, 0.3, BORDER)
  labelValue(page, 'Required By', input.requiredBy || '—', ML + 4, y - 7, small, bold, col4 * 2)
  y -= 20
  y -= 6

  // ── CUSTOMER & SITE ───────────────────────────────────────────────────────────
  y = sectionHeader(page, 'CUSTOMER & SITE', ML, y, CW, secH, bold)

  rect(page, ML, y - 22, CW, 22, WHITE)
  const half = CW / 2
  labelValue(page, 'Customer',     input.customerName,   ML + 4,        y - 7, small, bold, half)
  labelValue(page, 'Site Contact', input.siteContact,    ML + 4 + half, y - 7, small, bold, half)
  y -= 22

  rect(page, ML, y - 22, CW, 22, LTGRAY)
  line(page, ML, y - 22, ML + CW, y - 22, 0.3, BORDER)
  labelValue(page, 'Site Address',       input.siteAddress,       ML + 4,        y - 7, small, bold, half)
  labelValue(page, 'Customer Reference', input.customerReference, ML + 4 + half, y - 7, small, bold, half)
  y -= 22
  y -= 6

  // ── JOB INSTRUCTIONS ─────────────────────────────────────────────────────────
  if (input.importantNote) {
    y = sectionHeader(page, 'JOB INSTRUCTIONS', ML, y, CW, secH, bold)
    rect(page, ML, y - 22, CW, 22, AMBER)
    line(page, ML, y - 22, ML + CW, y - 22, 0.3, BORDER)
    t(page, 'IMPORTANT', ML + 6, y - 9, bold, 7, rgb(0.6, 0.35, 0))
    t(page, input.importantNote, ML + 60, y - 9, reg, 8, BLACK, CW - 66)
    y -= 22
    y -= 6
  }

  // ── DOORS ────────────────────────────────────────────────────────────────────
  for (const door of input.doors) {
    const doorLabel = door.qty > 1 ? `${door.label} (× ${door.qty})` : door.label
    y = sectionHeader(page, doorLabel, ML, y, CW, secH, bold)

    const c3 = CW / 4
    const rows: [string, string][][] = [
      [
        ['Material / Strip Type', door.materialType],
        ['Strip Profile',         door.profile],
        ['Strip Size',            `${door.stripSizeMm} mm`],
        ['Thickness',             `${door.thicknessMm} mm`],
      ],
      [
        ['Strip Length',   `${door.stripLengthMm} mm`],
        ['Strip Count',    String(door.stripCount)],
        ['Application',    door.application],
        ['Rivets & Hangers', door.rivetsHangers],
      ],
      [
        ['Door Width',         `${door.doorWidthMm} mm`],
        ['Door Height',        `${door.doorHeightMm} mm`],
        ['Headrail / Hardware', door.headrail],
        ['', ''],
      ],
    ]

    for (let ri = 0; ri < rows.length; ri++) {
      const bg = ri % 2 === 0 ? WHITE : LTGRAY
      rect(page, ML, y - 22, CW, 22, bg)
      line(page, ML, y - 22, ML + CW, y - 22, 0.3, BORDER)
      rows[ri].forEach(([lbl, val], ci) => {
        if (lbl) labelValue(page, lbl, val, ML + 4 + ci * c3, y - 7, small, bold, c3)
      })
      y -= 22
    }
    y -= 6
  }

  // ── MANUFACTURING CHECKLIST ───────────────────────────────────────────────────
  y = sectionHeader(page, 'MANUFACTURING PREPARATION CHECKLIST', ML, y, CW, secH, bold)

  const checklist: [string, string][] = [
    ['1. Materials allocated',       'Check the PVC strip size and thickness.'],
    ['2. Rivets & hangers material', 'Confirm Galvanised or Stainless Steel.'],
    ['3. Door measurement',          'Measure and confirm the required height / strip length.'],
    ['4. PVC strips cut',            'Cut according to the required door length.'],
    ['5. Quantity checked',          'Confirm the required strip count.'],
    ['6. Packaging',                 'Select the proper packaging boxes and pack the strips securely.'],
    ['7. Headrail / hardware prepared', 'Confirm all required hardware is ready.'],
    ['8. Headrail packed',           'Pack the headrail securely for delivery.'],
  ]

  const checkH = 22
  const halfCW = CW / 2
  for (let i = 0; i < checklist.length; i += 2) {
    const bg = (i / 2) % 2 === 0 ? WHITE : LTGRAY
    rect(page, ML, y - checkH, CW, checkH, bg)
    line(page, ML, y - checkH, ML + CW, y - checkH, 0.3, BORDER)

    const [lbl1, sub1] = checklist[i]
    const [lbl2, sub2] = checklist[i + 1] ?? ['', '']
    page.drawRectangle({ x: ML + 5, y: y - checkH + (checkH - 6) / 2, width: 6, height: 6, color: NAVY })
    t(page, lbl1, ML + 14, y - checkH + checkH / 2 + 2, bold, 8, BLACK)
    t(page, sub1, ML + 14, y - checkH + checkH / 2 - 6, small, 7, DKGRAY)
    if (lbl2) {
      page.drawRectangle({ x: ML + halfCW + 5, y: y - checkH + (checkH - 6) / 2, width: 6, height: 6, color: NAVY })
      t(page, lbl2, ML + halfCW + 14, y - checkH + checkH / 2 + 2, bold, 8, BLACK)
      t(page, sub2, ML + halfCW + 14, y - checkH + checkH / 2 - 6, small, 7, DKGRAY, halfCW - 20)
    }
    y -= checkH
  }
  y -= 6

  // ── MANUFACTURING COMPLETION ──────────────────────────────────────────────────
  y = sectionHeader(page, 'MANUFACTURING COMPLETION', ML, y, CW, secH, bold)
  const compH = 38
  rect(page, ML, y - compH, CW, compH, WHITE)
  line(page, ML, y - compH, ML + CW, y - compH, 0.3, BORDER)

  const thirdW = CW / 3
  t(page, 'PREPARED BY', ML + 4, y - 9, small, 6, DKGRAY)
  line(page, ML + 4, y - 28, ML + thirdW - 4, y - 28, 0.5, MIDGRAY)

  t(page, 'DATE', ML + 4 + thirdW, y - 9, small, 6, DKGRAY)
  line(page, ML + 4 + thirdW, y - 28, ML + thirdW * 2 - 4, y - 28, 0.5, MIDGRAY)

  t(page, 'STATUS', ML + 4 + thirdW * 2, y - 9, small, 6, DKGRAY)
  const statX = ML + 4 + thirdW * 2
  const statY = y - 22
  ;[['Complete', 0], ['Partial', 52], ['Issue', 108]].forEach(([lbl, ox]) => {
    page.drawRectangle({ x: statX + Number(ox), y: statY, width: 7, height: 7, color: NAVY })
    t(page, String(lbl), statX + Number(ox) + 10, statY + 1, reg, 7.5, BLACK)
  })
  y -= compH
  y -= 10

  // ── Footer ───────────────────────────────────────────────────────────────────
  line(page, ML, y, ML + CW, y, 0.5, MIDGRAY)
  y -= 12
  t(page, 'NBE Australia Pty Ltd  •  ABN 17 007 048 008', ML, y, small, 7.5, DKGRAY)
  t(page, 'Internal Manufacturing Job Card', ML + CW - 120, y, small, 7.5, DKGRAY)

  return pdfDoc.save()
}
