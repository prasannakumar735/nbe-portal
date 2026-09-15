import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'

// Convert WebP → PNG in-process so pdf-lib can embed it
async function webpToPng(filePath: string): Promise<Buffer | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require('sharp') as typeof import('sharp')
    return await sharp(filePath).png().toBuffer()
  } catch { return null }
}

function colourToCode(colour: string): string {
  const key = colour.toLowerCase().split(/[\s_-]/)[0]
  const map: Record<string, string> = {
    blue: 'BL', green: 'GN', grey: 'GY', gray: 'GY',
    orange: 'OR', red: 'RD', yellow: 'YL', black: 'BK',
  }
  return map[key] ?? 'GY'
}

const KEY_FEATURES: Record<string, { icon: string; title: string; desc: string }[]> = {
  SP01: [
    { icon: 'XL-Opening',    title: 'Large Opening Capacity',    desc: 'Suited to wider and taller openings' },
    { icon: 'Heavy-Duty',    title: 'Heavy-Duty Construction',   desc: 'Reinforced for demanding environments' },
    { icon: 'Reinforcement', title: 'Fibreglass Reinforcement',  desc: 'Improved impact absorption and rebound' },
    { icon: 'Safety',        title: 'Integrated Safety',         desc: 'Safety edge and photoelectric sensors' },
  ],
  PE01: [
    { icon: 'Speed',         title: 'High-Speed Operation',      desc: 'Up to 2.2 m/s opening speed' },
    { icon: 'Reinforcement', title: 'Fibreglass Reinforcement',  desc: 'Flexible stiffeners improve durability' },
    { icon: 'Modular',       title: 'Modular Curtain System',    desc: 'Replaceable sections simplify maintenance' },
    { icon: 'Safety',        title: 'Integrated Safety',         desc: 'Safety edge and photoelectric sensors' },
  ],
  FR01: [
    { icon: 'Insulation',   title: 'Insulated Curtain System',  desc: 'Helps reduce temperature transfer' },
    { icon: 'ColdStorage',  title: 'Heated Guide System',       desc: 'Minimises ice build-up in guides' },
    { icon: 'Speed',        title: 'Cold-Chain Efficiency',     desc: 'Supports freezer and coolroom access' },
    { icon: 'Safety',       title: 'Integrated Safety',         desc: 'Safety edge and photoelectric sensors' },
  ],
  CAD01: [
    { icon: 'XL-Opening',  title: 'Ex-Large Opening Capacity', desc: 'Suitable for oversized industrial openings' },
    { icon: 'Wind',         title: 'Wind-Resistant Structure',  desc: 'Designed for exposed site conditions' },
    { icon: 'Folding',      title: 'Folding Door Configuration',desc: 'Controlled folding without roller drum' },
    { icon: 'Safety',       title: 'Integrated Safety',         desc: 'Photoelectric sensors and safety systems' },
  ],
  CL01: [
    { icon: 'Speed',      title: 'Rapid Controlled Access',   desc: 'Fast operation for controlled zones' },
    { icon: 'Dust&Air',   title: 'Environmental Separation',  desc: 'Supports pressure and contamination control' },
    { icon: 'Hygienic02', title: 'Hygienic Design',           desc: 'Suitable for clean manufacturing environments' },
    { icon: 'IP65',       title: 'Stainless Steel / IP65',    desc: 'Washdown-ready, hygiene-focused construction' },
  ],
  ES01: [
    { icon: 'Cost_Effective',     title: 'Cost-Effective Solution',   desc: 'Practical rapid door for budget-focused projects' },
    { icon: 'Speed',              title: 'High-Speed Operation',       desc: 'Up to 1.8 m/s opening speed' },
    { icon: 'Servo-Controlled01', title: 'Servo-Controlled System',   desc: 'Smooth and reliable door movement' },
    { icon: 'Safety',             title: 'Integrated Safety',          desc: 'Photoelectric sensors and optional safety edge' },
  ],
}

const DOOR_TECH_SPECS: Record<string, { openingSpeed: string; doorControl: string; powerSupply: string }> = {
  SP01:  { openingSpeed: '1.5 m/s', doorControl: 'Encoder', powerSupply: '1Ø-240V' },
  PE01:  { openingSpeed: '2.2 m/s', doorControl: 'Encoder', powerSupply: '1Ø-240V' },
  FR01:  { openingSpeed: '1.0 m/s', doorControl: 'Encoder', powerSupply: '1Ø-240V' },
  CAD01: { openingSpeed: '1.0 m/s', doorControl: 'Encoder', powerSupply: '1Ø-240V' },
  CL01:  { openingSpeed: '1.5 m/s', doorControl: 'Encoder', powerSupply: '1Ø-240V' },
  ES01:  { openingSpeed: '1.8 m/s', doorControl: 'Encoder', powerSupply: '1Ø-240V' },
}

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
  individualInstall?:      boolean   // when true and !includeSummary, each door shows its own costs; otherwise combined on last door
  customDoorImageBase64?:  string    // data URL (data:image/...;base64,...) — overrides doorImagePath on all doors
  tcPdfBytes?:             Buffer    // pre-fetched T&C PDF bytes from Supabase storage; overrides local file lookup
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

// ── Page: Per-door detail (new layout matching reference design) ──────────────

async function drawPageDoor(
  pdfDoc: PDFDocument,
  door: DoorLineItem,
  doorIndex: number,
  fonts: { reg: PDFFont; bold: PDFFont; display: PDFFont },
  logoImg: Awaited<ReturnType<typeof PDFDocument.prototype.embedPng>> | null,
) {
  const { reg, bold } = fonts
  const page = pdfDoc.addPage([595.28, 841.89])
  const PW = 595.28
  const ML = 36, MR = 36, CW = PW - ML - MR
  let y = 800

  const doorRef = `D${String(doorIndex + 1).padStart(2, '0')}`

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

  // "DOOR  D01" large, right-aligned — regular weight (#5)
  const doorRefLabel = `DOOR  ${doorRef}`
  t(page, doorRefLabel, PW - MR - reg.widthOfTextAtSize(doorRefLabel, 32), y - 28, reg, 32, BLACK)

  // "INDUSTRIAL RAPID DOOR" subtitle
  const subtitle = 'INDUSTRIAL RAPID DOOR'
  t(page, subtitle, PW - MR - bold.widthOfTextAtSize(subtitle, 13), y - 62, bold, 13, BRAND)

  y -= logoH + 30  // more gap after DOOR D01 (#6)
  drawHLine(page, ML, y, CW, 1, DARK)
  y -= 32  // more gap before door title (#1)

  // ── DOOR TITLE ────────────────────────────────────────────────────────────
  t(page, `${door.doorType} | ${door.doorTypeName}`, ML, y, bold, 18, BLACK)
  y -= 26
  t(page, `Opening:   ${door.openingW} CW × ${door.openingH} CH mm   |   Quantity ${door.qty}`, ML, y, reg, 12, DARK)
  y -= 28

  // ── DOOR SPECIFICATION header bar ─────────────────────────────────────────
  const specBarH = 20
  drawRect(page, ML, y - specBarH, CW, specBarH, BRAND)
  t(page, 'DOOR SPECIFICATION', ML + 8, y - 13, bold, 10.5, WHITE)
  y -= specBarH

  // Two-column layout: left = spec table (wider), right = image + key features (narrower)
  const leftColW = 300
  const colGap   = 10
  const rightColX = ML + leftColW + colGap
  const rightColW = CW - leftColW - colGap
  const specTopY  = y

  // ── LEFT: spec table (no row separator lines) ─────────────────────────────
  const lblX = ML + 4, valX = ML + 118, rowH = 19
  const techSpec = DOOR_TECH_SPECS[door.doorType] ?? { openingSpeed: '-', doorControl: 'Encoder', powerSupply: '1Ø-240V' }
  const safetyEdgeColour = (door as unknown as { safetyEdgeColour?: string }).safetyEdgeColour ?? ''

  const specRows: { label: string; value: string; grey?: boolean }[] = [
    { label: 'Reference Nr.',      value: doorRef },
    { label: 'Model',              value: `${door.doorType} | ${door.doorTypeName}` },
    { label: 'Opening Size (Clear)', value: `${door.openingW} CW × ${door.openingH} CH mm` },
    { label: 'External Size',      value: door.externalW ? `${door.externalW} XW × ${door.externalH} XH mm` : '', grey: true },
    { label: 'Frame Material',     value: door.frame },
    { label: 'Curtain Material',   value: door.curtain },
    { label: 'Curtain Colour',     value: door.colour },
    { label: 'Safety Edge Colour', value: safetyEdgeColour },
    { label: 'Motor',              value: door.motorKw ? `${door.motorKw} KW` : '' },
    { label: 'Motor Side',         value: door.motorSide },
    { label: 'Door Control',       value: techSpec.doorControl },
    { label: 'Power Supply',       value: techSpec.powerSupply },
    { label: 'Opening Speed',      value: techSpec.openingSpeed },
  ]

  let ly = specTopY - 12  // extra top padding after header bar (#3)
  specRows.forEach(({ label, value, grey }) => {
    t(page, label, lblX, ly - 9, reg, 8.5, GREY)   // larger font (#6)
    t(page, value, valX, ly - 9, reg, 8.5, grey ? GREY : DARK)
    ly -= rowH
  })
  ly -= 16  // wider gap between spec list and Safety Features (#4)

  // Safety Features + Activation — 3-column:
  //   col1 (section label) = lblX (aligns with spec labels)
  //   col2 (sub-label)     = valX (aligns with spec values)
  //   col3 (value)         = ML + 210
  const sfValX = ML + 210
  const sfRowH = 17
  const sfRows: { section: string; label: string; value: string }[] = [
    { section: 'Safety Features', label: 'Indicator Lamp',  value: '(Amber Strobe Light)' },
    { section: '',                label: 'Safety Sensor',   value: door.safetyByCategory?.safety       ?? '-' },
    { section: '',                label: 'Safety Edge',     value: '-' },
    { section: '',                label: 'Other',           value: '' },
    { section: 'Activation',      label: 'Push Button',     value: door.safetyByCategory?.pushButton    ?? '-' },
    { section: '',                label: 'Radar',           value: door.safetyByCategory?.radar         ?? '-' },
    { section: '',                label: 'Remote Control',  value: door.safetyByCategory?.remoteControl ?? '-' },
    { section: '',                label: 'Induction Loop',  value: door.safetyByCategory?.inductLoop    ?? '-' },
    { section: '',                label: 'Other',           value: door.safetyByCategory?.swipe         ?? '-' },
  ]
  sfRows.forEach(({ section, label, value }) => {
    if (section) t(page, section, lblX,  ly - 8, reg, 8.5, DARK)
    t(page, label,   valX,   ly - 8, reg, 8.5, DARK)
    t(page, value,   sfValX, ly - 8, reg, 8,   GREY)
    ly -= sfRowH
  })

  // ── RIGHT: door image + KEY FEATURES (light grey background) ─────────────
  const LIGHT_GREY = rgb(0.95, 0.95, 0.95)
  const imgCode = colourToCode(door.colour)
  const newImgPath = path.join(process.cwd(), 'public', 'images', 'DOOR_WEBP', `${door.doorType}_${imgCode}.webp`)
  let doorImgEmbed: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  let imgDrawW = 0, imgDrawH = 0
  try {
    const pngBuf = await webpToPng(newImgPath)
    if (pngBuf) {
      doorImgEmbed = await pdfDoc.embedPng(pngBuf)
      const { width: dw, height: dh } = doorImgEmbed
      const maxW = rightColW - 8, maxH = 190
      imgDrawW = maxW
      imgDrawH = (dh / dw) * imgDrawW
      if (imgDrawH > maxH) { imgDrawH = maxH; imgDrawW = (dw / dh) * imgDrawH }
    }
  } catch { /* no image */ }

  let rightY = specTopY
  const imgTopPad = 10  // white space above image

  // Grey background only for the image itself; caption sits below on white (#1)
  if (doorImgEmbed && imgDrawW > 0) {
    drawRect(page, rightColX, rightY - imgDrawH - 8 - imgTopPad, rightColW, imgDrawH + 8, LIGHT_GREY)
    page.drawImage(doorImgEmbed, {
      x: rightColX + (rightColW - imgDrawW) / 2,
      y: rightY - imgDrawH - 4 - imgTopPad,
      width: imgDrawW,
      height: imgDrawH,
    })
    rightY -= imgDrawH + 12 + imgTopPad  // gap between image bottom and caption
    const cap = 'Indicative Image - Configuration may vary'
    page.drawText(cap, { x: rightColX + (rightColW - reg.widthOfTextAtSize(cap, 7)) / 2, y: rightY - 2, size: 7, font: reg, color: GREY })
    rightY -= 14
  }

  // KEY FEATURES header + grey-background rows
  const features = KEY_FEATURES[door.doorType] ?? KEY_FEATURES['SP01']
  const kfBarH = 18
  const iconSize = 24
  const featRowH = 34
  const kfTotalH = kfBarH + features.length * featRowH
  drawRect(page, rightColX, rightY - kfBarH, rightColW, kfBarH, BRAND)
  t(page, 'KEY FEATURES', rightColX + 8, rightY - 12, bold, 10.5, WHITE)
  rightY -= kfBarH
  // Grey background for all feature rows
  drawRect(page, rightColX, rightY - (kfTotalH - kfBarH), rightColW, kfTotalH - kfBarH, LIGHT_GREY)

  for (const feat of features) {
    const iconPath = path.join(process.cwd(), 'public', 'ICONS', `${feat.icon}.webp`)
    try {
      const iconBuf = await webpToPng(iconPath)
      if (iconBuf) {
        const iconEmbed = await pdfDoc.embedPng(iconBuf)
        page.drawImage(iconEmbed, {
          x: rightColX + 5,
          y: rightY - featRowH + (featRowH - iconSize) / 2,
          width: iconSize,
          height: iconSize,
        })
      }
    } catch { /* no icon */ }
    t(page, feat.title, rightColX + 34, rightY - 12, bold, 8, DARK)
    t(page, feat.desc,  rightColX + 34, rightY - 22, reg,  7.5, GREY)
    drawHLine(page, rightColX, rightY - featRowH, rightColW, 0.3, rgb(0.85, 0.85, 0.85))
    rightY -= featRowH
  }

  // ── SITE WORKS ────────────────────────────────────────────────────────────
  const contentBottom = Math.min(ly - 8, rightY - 8)
  y = Math.max(contentBottom - 8, 175)  // never overlap footer

  const swBarH = 20
  drawRect(page, ML, y - swBarH, leftColW, swBarH, BRAND)
  t(page, 'SITE WORKS (OPTIONAL)', ML + 8, y - 13, bold, 10.5, WHITE)
  y -= swBarH

  const swHalf = leftColW
  const demolRequired = (door.demolition ?? 0) > 0
  const swRowH = 18
  const swContentH = swRowH * 3  // 3 rows: Demolition Required, Demolition, Scope

  // Grey background for left SITE WORKS content area (#5)
  drawRect(page, ML, y - swContentH, leftColW, swContentH, LIGHT_GREY)

  // Left: demolition details
  let swY = y
  drawHLine(page, ML, swY, swHalf, 0.4, rgb(0.80, 0.80, 0.80))
  t(page, 'Demolition Required', ML + 4, swY - 11, reg, 8, DARK)
  page.drawRectangle({ x: ML + 104, y: swY - 17, width: 9, height: 9, borderColor: DARK, borderWidth: 0.5, color: WHITE })
  if (demolRequired) {
    page.drawLine({ start: { x: ML + 105.5, y: swY - 14 }, end: { x: ML + 107.5, y: swY - 17 }, thickness: 1, color: DARK })
    page.drawLine({ start: { x: ML + 107.5, y: swY - 17 }, end: { x: ML + 112,   y: swY - 10 }, thickness: 1, color: DARK })
  }
  t(page, 'Yes', ML + 116, swY - 11, reg, 8, DARK)
  page.drawRectangle({ x: ML + 136, y: swY - 17, width: 9, height: 9, borderColor: DARK, borderWidth: 0.5, color: WHITE })
  if (!demolRequired) {
    page.drawLine({ start: { x: ML + 137.5, y: swY - 14 }, end: { x: ML + 139.5, y: swY - 17 }, thickness: 1, color: DARK })
    page.drawLine({ start: { x: ML + 139.5, y: swY - 17 }, end: { x: ML + 144,   y: swY - 10 }, thickness: 1, color: DARK })
  }
  t(page, 'No', ML + 148, swY - 11, reg, 8, DARK)
  swY -= swRowH

  drawHLine(page, ML, swY, swHalf, 0.4, rgb(0.80, 0.80, 0.80))
  t(page, 'Demolition', ML + 4, swY - 11, reg, 8, DARK)
  if (demolRequired) {
    t(page, fmtAUD(door.demolition), ML + 68, swY - 11, reg, 8, DARK)
    t(page, '(ex. GST)',             ML + 130, swY - 11, reg, 7.5, GREY)
  }
  swY -= swRowH

  drawHLine(page, ML, swY, swHalf, 0.4, rgb(0.80, 0.80, 0.80))
  t(page, 'Scope', ML + 4, swY - 11, reg, 8, DARK)
  if (demolRequired) t(page, 'Remove the existing Door', ML + 48, swY - 11, reg, 8, DARK)
  swY -= swRowH
  drawHLine(page, ML, swY, swHalf, 0.4, rgb(0.80, 0.80, 0.80))

  // Right: pricing (aligned to right column)
  let prY = y
  t(page, 'Unit Door Price', rightColX, prY - 11, reg, 9, DARK)
  tRight(page, `$  ${door.unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, ML + CW, prY - 11, reg, 9, DARK)
  prY -= swRowH

  t(page, 'Quantity', rightColX, prY - 11, reg, 9, DARK)
  tRight(page, String(door.qty), ML + CW, prY - 11, reg, 9, DARK)
  prY -= swRowH + 2

  // DOOR SUBTOTAL bar
  const stH = 22
  drawRect(page, rightColX - 4, prY - stH, rightColW + 4, stH, BLACK)
  t(page, 'DOOR SUBTOTAL (ex. GST)', rightColX + 2, prY - 15, bold, 8.5, WHITE)
  tRight(page, `$  ${(door.qty * door.unitPrice).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, ML + CW, prY - 15, bold, 9, WHITE)
  prY -= stH + 2

  if (demolRequired) {
    t(page, 'Demolition Cost', rightColX, prY - 11, reg, 9, DARK)
    tRight(page, `$  ${door.demolition.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, ML + CW, prY - 11, reg, 9, DARK)
  }
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

  const subtitle = 'INDUSTRIAL RAPID DOOR'
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
  t(page, 'REF',         cNo + 2,  y - 14, bold, 9, WHITE)
  t(page, 'ITEM',        cItem,    y - 14, bold, 9, WHITE)
  t(page, 'DESCRIPTION', cDesc,    y - 14, bold, 9, WHITE)
  tCenter(page, 'QTY',        cQtyX, cQtyW, y - 14, bold, 9, WHITE)
  tRight(page,  'DOOR PRICE', cUpRight,     y - 14, bold, 9, WHITE)
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
  const doorSubtotal = doors.reduce((s, d) => s + d.qty * d.unitPrice, 0)
  const totalInstall = doors.reduce((s, d) => s + d.installation, 0)
  const totalDemol   = doors.reduce((s, d) => s + d.demolition, 0)
  const totalEquip   = doors.reduce((s, d) => s + d.equipHire, 0)
  const totalTravel  = doors.reduce((s, d) => s + d.accTravel, 0)

  // Sub Total row (door prices from the per-door pages)
  const addlRowH = 18
  drawHLine(page, ML, y, CW, 0.6, rgb(0.65, 0.65, 0.65))
  t(page, 'Sub Total',        cDesc,     y - 12, bold, 9, DARK)
  tCenter(page, String(totalQty), cQtyX, cQtyW, y - 12, reg, 9, DARK)
  tRight(page, fmtAUD(doorSubtotal), cUpRight,  y - 12, reg, 9, DARK)
  tRight(page, fmtAUD(doorSubtotal), cTotRight, y - 12, bold, 9, DARK)
  y -= addlRowH

  const addlRows: [string, number][] = [
    ['Installation',           totalInstall],
    ['Demolition',             totalDemol],
    ['Equipment Hire',         totalEquip],
    ['Accommodation & Travel', totalTravel],
  ]
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

  // ── FOOTER TERMS ─────────────────────────────────────────────────────────
  const DEFAULT_PAGE2_SUMMARY_NOTE = "Subject to NBE Australia's standard Terms & Conditions. Final dimensions, site conditions and access must be confirmed prior to manufacture. Delivery, equipment hire and installation are excluded unless shown as priced line items. Electrical works are limited to connections between the control panel and door equipment. Power supply and isolator shall be provided by others."
  const terms = input.page2SummaryNote?.trim() || DEFAULT_PAGE2_SUMMARY_NOTE
  const footerSize = 8.5
  const footerLineH = 11
  const footerLines = terms.split('\n').flatMap(para => wrapText(para, reg, footerSize, CW))
  // Leave room for the page-number footer bar (drawn in post-processing at y ~= 20)
  const footerStartY = 52 + (footerLines.length - 1) * footerLineH
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

  const includeSummary    = input.includeSummary    !== false  // default true
  const individualInstall = input.individualInstall === true   // default false

  // Summary page first (customer-facing quote overview)
  if (includeSummary) {
    await drawPage2(pdfDoc, input, doors, grandTotal, fonts, logoImg)
  }

  // Per-door detail pages (spec table, image, key features, site works)
  for (let i = 0; i < doors.length; i++) {
    await drawPageDoor(pdfDoc, doors[i], i, fonts, logoImg)
  }

  // ── Append T&C pages — Supabase-uploaded bytes take priority over bundled local files ──
  const TC_FILES: Record<string, string> = {
    CUSTOMER:    'Rapid Door_T&C for CUSTOMERS.pdf',
    DISTRIBUTOR: 'Rapid Door_T&C for DISTRIBUTOR.pdf',
    TENDER:      'Rapid Door_T&C for TENDER.pdf',
  }
  const tcFile = input.endUser ? TC_FILES[input.endUser] : null
  const tcSource = input.tcPdfBytes ?? (tcFile ? await readFile(path.join(process.cwd(), 'public', 'documents', tcFile)).catch(() => null) : null)
  if (tcSource) {
    try {
      const tcDoc  = await PDFDocument.load(tcSource)
      const copied = await pdfDoc.copyPages(tcDoc, tcDoc.getPageIndices())
      copied.forEach(p => pdfDoc.addPage(p))
    } catch (e) {
      console.error('Failed to append T&C:', e)
    }
  }

  // ── Footer bar: NBE AUSTRALIA (left) + Quote No. | Page X of N (right) ───
  // Applied to all quote pages (door pages + summary), not T&C pages.
  const totalPages     = pdfDoc.getPageCount()
  const quotePageCount = doors.length + (includeSummary ? 1 : 0)
  const pages = pdfDoc.getPages()
  for (let pi = 0; pi < quotePageCount; pi++) {
    const pg = pages[pi]
    const pgPW = pg.getWidth()
    const pgML = 36, pgMR = 36, pgCW = pgPW - pgML - pgMR
    const fy = 20   // footer baseline

    // Left: company name + website
    pg.drawText('NBE AUSTRALIA', { x: pgML, y: fy + 8, size: 7.5, font: bold, color: DARK })
    pg.drawText('nbeaustralia.com.au', { x: pgML, y: fy - 2, size: 7, font: reg, color: GREY })

    // Separator line above footer
    pg.drawLine({ start: { x: pgML, y: fy + 18 }, end: { x: pgML + pgCW, y: fy + 18 }, thickness: 0.4, color: rgb(0.75, 0.75, 0.75) })

    // Right: Quote No. | section | Page X of N
    const pageLabel = `Quote No. ${input.quoteNumber}  |  INDUSTRIAL RAPID DOOR  |  Page ${pi + 1} of ${totalPages}`
    pg.drawText(pageLabel, {
      x: pgML + pgCW - bold.widthOfTextAtSize(pageLabel, 7.5),
      y: fy + 3,
      size: 7.5,
      font: reg,
      color: GREY,
    })
  }

  // Set PDF title so the browser viewer's download button uses the correct filename
  const safeCust = (input.customerName || 'CUSTOMER')
    .replace(/[^a-zA-Z0-9\s]/g, ' ').trim().replace(/\s+/g, '_').slice(0, 50)
  const euPart = input.endUser ? `_${input.endUser}` : ''
  pdfDoc.setTitle(`${input.quoteNumber}_${safeCust}${euPart}`)

  return pdfDoc.save()
}
