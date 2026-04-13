import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { PDF_MARGIN, PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH } from '@/lib/pdf/pdfLayout'
import { savePdfBytes } from '@/lib/pdf/savePdf'
import { embedRobotoForPdfLib } from '@/lib/pdf/robotoPdf'
import type { SignOffDisplayMetrics, SignOffFindingGroup } from '@/lib/maintenance/reportMetrics'

type PDFFontType = Awaited<ReturnType<PDFDocument['embedFont']>>
type PDFImageType = Awaited<ReturnType<PDFDocument['embedPng']>>

const BORDER = rgb(0.85, 0.87, 0.9)
const LABEL_MUTED = rgb(0.45, 0.48, 0.52)
const TEXT_BODY = rgb(0.15, 0.17, 0.2)
const HEALTH_GREEN = rgb(0.05, 0.45, 0.28)
const TITLE_NAVY = rgb(0.1, 0.2, 0.45)

const LOGO_MAX_W = 100
const LOGO_MAX_H = 44
const HEADER_TITLE_GAP = 16

function strokeRect(
  page: import('pdf-lib').PDFPage,
  x: number,
  yBottom: number,
  width: number,
  height: number
) {
  const yTop = yBottom + height
  page.drawLine({ start: { x, y: yBottom }, end: { x: x + width, y: yBottom }, thickness: 1, color: BORDER })
  page.drawLine({ start: { x, y: yTop }, end: { x: x + width, y: yTop }, thickness: 1, color: BORDER })
  page.drawLine({ start: { x, y: yBottom }, end: { x, y: yTop }, thickness: 1, color: BORDER })
  page.drawLine({ start: { x: x + width, y: yBottom }, end: { x: x + width, y: yTop }, thickness: 1, color: BORDER })
}

/**
 * Logo left, title beside logo, divider below header band.
 * @returns baseline Y for first line of body (Summary) — always below divider with safe gap.
 */
function drawHeaderStrip(
  page: import('pdf-lib').PDFPage,
  logoImage: PDFImageType | null,
  bold: PDFFontType
): number {
  const bandTop = PDF_PAGE_HEIGHT - PDF_MARGIN
  const titleText = 'Approval & Sign-off'
  const titleSize = 16

  let logoBottom = bandTop
  if (logoImage) {
    const scale = Math.min(LOGO_MAX_W / logoImage.width, LOGO_MAX_H / logoImage.height, 1)
    const w = logoImage.width * scale
    const h = logoImage.height * scale
    page.drawImage(logoImage, {
      x: PDF_MARGIN,
      y: bandTop - h,
      width: w,
      height: h,
    })
    logoBottom = bandTop - h
  } else {
    logoBottom = bandTop - 36
  }

  const titleX = PDF_MARGIN + (logoImage ? LOGO_MAX_W + HEADER_TITLE_GAP : 0)
  const titleBaseline = bandTop - 10
  page.drawText(titleText, {
    x: titleX,
    y: titleBaseline,
    size: titleSize,
    font: bold,
    color: TITLE_NAVY,
  })

  const titleVisualBottom = titleBaseline - titleSize - 4
  const dividerY = Math.min(logoBottom, titleVisualBottom) - 14
  page.drawLine({
    start: { x: PDF_MARGIN, y: dividerY },
    end: { x: PDF_PAGE_WIDTH - PDF_MARGIN, y: dividerY },
    thickness: 1,
    color: rgb(0.82, 0.84, 0.88),
  })

  return dividerY - 28
}

function formatFindingGroupLine(g: SignOffFindingGroup): string {
  const parts: string[] = []
  if (g.caution > 0) {
    parts.push(`${g.caution} ${g.caution === 1 ? 'caution' : 'cautions'}`)
  }
  if (g.fault > 0) {
    parts.push(`${g.fault} ${g.fault === 1 ? 'fault' : 'faults'}`)
  }
  if (parts.length === 0) return ''
  return `- ${g.section} -> ${parts.join(', ')}`
}

function drawSummaryAndFindings(
  page: import('pdf-lib').PDFPage,
  startY: number,
  metrics: SignOffDisplayMetrics,
  findingGroups: SignOffFindingGroup[],
  font: PDFFontType,
  bold: PDFFontType,
): number {
  let y = startY
  const labelSize = 9
  const valueSize = 9
  const gap = 11
  /** Tight value column (~60pt) — numbers stay near labels */
  const VALUE_COL_W = 60
  const VALUE_COL_RIGHT = PDF_MARGIN + 125 + VALUE_COL_W

  page.drawText('Summary', {
    x: PDF_MARGIN,
    y,
    size: 14,
    font: bold,
    color: TITLE_NAVY,
  })
  y -= 20

  const validChecks = metrics.totalChecks - metrics.na
  const healthScore =
    validChecks > 0 ? Math.round((metrics.good / validChecks) * 100) : 0

  const summaryRows: [string, string][] = [
    ['Total doors', String(metrics.totalDoors)],
    ['Total checks', String(metrics.totalChecks)],
    ['Good', String(metrics.good)],
    ['Caution', String(metrics.caution)],
    ['Fault', String(metrics.fault)],
  ]
  for (const [lab, val] of summaryRows) {
    page.drawText(lab, {
      x: PDF_MARGIN,
      y,
      size: labelSize,
      font,
      color: LABEL_MUTED,
    })
    const vw = font.widthOfTextAtSize(val, valueSize)
    page.drawText(val, {
      x: VALUE_COL_RIGHT - vw,
      y,
      size: valueSize,
      font,
      color: TEXT_BODY,
    })
    y -= gap
  }

  y -= 6
  page.drawText(`Overall Health Score: ${healthScore}%`, {
    x: PDF_MARGIN,
    y,
    size: 11,
    font: bold,
    color: HEALTH_GREEN,
  })
  y -= 24

  page.drawText('Findings by section', {
    x: PDF_MARGIN,
    y,
    size: 11,
    font: bold,
    color: TITLE_NAVY,
  })
  y -= 16

  const nonEmpty = findingGroups.filter(g => g.caution > 0 || g.fault > 0)
  const maxFindings = 18
  const slice = nonEmpty.slice(0, maxFindings)

  if (slice.length === 0) {
    page.drawText('No faults or cautions recorded.', {
      x: PDF_MARGIN,
      y,
      size: 9,
      font,
      color: LABEL_MUTED,
    })
    y -= 12
  } else {
    for (const g of slice) {
      const line = formatFindingGroupLine(g)
      if (!line) continue
      const text = line.length > 95 ? `${line.slice(0, 92)}...` : line
      page.drawText(text, {
        x: PDF_MARGIN,
        y,
        size: 9,
        font,
        color: TEXT_BODY,
      })
      y -= 12
    }
    if (nonEmpty.length > maxFindings) {
      page.drawText(`… and ${nonEmpty.length - maxFindings} more`, {
        x: PDF_MARGIN,
        y,
        size: 8,
        font,
        color: LABEL_MUTED,
      })
      y -= 11
    }
  }

  y -= 10
  page.drawLine({
    start: { x: PDF_MARGIN, y },
    end: { x: PDF_PAGE_WIDTH - PDF_MARGIN, y },
    thickness: 0.75,
    color: rgb(0.82, 0.84, 0.88),
  })
  y -= 20
  return y
}

export type MergedReportSignaturePdfInput = {
  logoBytes: Uint8Array | null
  technicianName: string
  technicianSignatureBytes: Uint8Array | null
  reportDateLabel: string
  signOff: {
    metrics: SignOffDisplayMetrics
    findingGroups: SignOffFindingGroup[]
  }
}

/** Final page: summary, findings, technician / manager, date / client acknowledgement */
export async function generateMergedReportSignaturePdf(
  input: MergedReportSignaturePdfInput
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT])
  const roboto = await embedRobotoForPdfLib(pdf)
  const font = roboto?.regular ?? (await pdf.embedFont(StandardFonts.Helvetica))
  const bold = roboto?.bold ?? (await pdf.embedFont(StandardFonts.HelveticaBold))

  let logoImage: PDFImageType | null = null
  if (input.logoBytes && input.logoBytes.length > 0) {
    try {
      logoImage = await pdf.embedPng(input.logoBytes)
    } catch {
      try {
        logoImage = await pdf.embedJpg(input.logoBytes)
      } catch {
        logoImage = null
      }
    }
  }

  let signatureImage: PDFImageType | null = null
  if (input.technicianSignatureBytes && input.technicianSignatureBytes.length > 0) {
    try {
      signatureImage = await pdf.embedPng(input.technicianSignatureBytes)
    } catch {
      try {
        signatureImage = await pdf.embedJpg(input.technicianSignatureBytes)
      } catch {
        signatureImage = null
      }
    }
  }

  const bodyStartY = drawHeaderStrip(page, logoImage, bold)
  let y = drawSummaryAndFindings(
    page,
    bodyStartY,
    input.signOff.metrics,
    input.signOff.findingGroups,
    font,
    bold,
  )

  const colGap = 32
  const colW = (PDF_PAGE_WIDTH - PDF_MARGIN * 2 - colGap) / 2
  const sigBoxH = 72
  const leftX = PDF_MARGIN
  const rightX = PDF_MARGIN + colW + colGap

  page.drawText('Technician', {
    x: leftX,
    y,
    size: 11,
    font: bold,
    color: TITLE_NAVY,
  })
  page.drawText('Manager', {
    x: rightX,
    y,
    size: 11,
    font: bold,
    color: TITLE_NAVY,
  })
  y -= 14

  strokeRect(page, leftX, y - sigBoxH, colW, sigBoxH)
  if (signatureImage) {
    const maxH = sigBoxH - 12
    const maxW = colW - 12
    const scale = Math.min(maxW / signatureImage.width, maxH / signatureImage.height, 1)
    const w = signatureImage.width * scale
    const h = signatureImage.height * scale
    page.drawImage(signatureImage, {
      x: leftX + 6,
      y: y - 6 - h,
      width: w,
      height: h,
    })
  } else {
    page.drawText('Signature', {
      x: leftX + 8,
      y: y - sigBoxH / 2,
      size: 9,
      font,
      color: rgb(0.55, 0.55, 0.58),
    })
  }

  strokeRect(page, rightX, y - sigBoxH, colW, sigBoxH)

  y -= sigBoxH + 10
  page.drawText(input.technicianName || '-', {
    x: leftX,
    y,
    size: 10,
    font,
    color: TEXT_BODY,
  })
  page.drawText('Authorised signatory', {
    x: rightX,
    y,
    size: 9,
    font,
    color: LABEL_MUTED,
  })
  y -= 30

  page.drawText('Date', {
    x: leftX,
    y,
    size: 11,
    font: bold,
    color: TITLE_NAVY,
  })
  page.drawText('Client acknowledgement', {
    x: rightX,
    y,
    size: 11,
    font: bold,
    color: TITLE_NAVY,
  })
  y -= 14

  const lineBoxH = 44
  strokeRect(page, leftX, y - lineBoxH, colW, lineBoxH)
  page.drawText(input.reportDateLabel || '-', {
    x: leftX + 8,
    y: y - 22,
    size: 10,
    font,
    color: TEXT_BODY,
  })

  strokeRect(page, rightX, y - lineBoxH, colW, lineBoxH)
  page.drawText('Name / signature / date', {
    x: rightX + 8,
    y: y - 22,
    size: 9,
    font,
    color: LABEL_MUTED,
  })

  return savePdfBytes(pdf)
}
