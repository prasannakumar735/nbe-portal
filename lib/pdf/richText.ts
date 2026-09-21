import type { PDFPage, PDFFont } from 'pdf-lib'
import { rgb } from 'pdf-lib'

export type RichSeg  = { text: string; bold: boolean; italic: boolean }
export type RichLine = {
  segments: RichSeg[]
  bullet:   boolean   // draw bullet prefix on this line
  indented: boolean   // indent to align with bullet continuation
}

type Fonts = { reg: PDFFont; bold: PDFFont; italic: PDFFont }

/** Parse a raw paragraph string into inline bold/italic segments. */
function parseInline(text: string): RichSeg[] {
  const segs: RichSeg[] = []
  let rest = text
  while (rest.length > 0) {
    const bIdx = rest.indexOf('**')
    const iIdx = rest.indexOf('_')
    const hasBold   = bIdx !== -1
    const hasItalic = iIdx !== -1

    if (!hasBold && !hasItalic) {
      segs.push({ text: rest, bold: false, italic: false })
      break
    }

    const useBold = hasBold && (!hasItalic || bIdx <= iIdx)
    const marker  = useBold ? '**' : '_'
    const start   = useBold ? bIdx : iIdx
    const end     = rest.indexOf(marker, start + marker.length)

    if (start > 0) segs.push({ text: rest.slice(0, start), bold: false, italic: false })

    if (end === -1) {
      segs.push({ text: rest.slice(start), bold: false, italic: false })
      break
    }

    segs.push({ text: rest.slice(start + marker.length, end), bold: useBold, italic: !useBold })
    rest = rest.slice(end + marker.length)
  }
  return segs.filter(s => s.text.length > 0)
}

function mergeSegs(segs: RichSeg[]): RichSeg[] {
  const out: RichSeg[] = []
  for (const s of segs) {
    const prev = out[out.length - 1]
    if (prev && prev.bold === s.bold && prev.italic === s.italic) prev.text += s.text
    else out.push({ ...s })
  }
  return out
}

function segWidth(segs: RichSeg[], fonts: Fonts, size: number): number {
  return segs.reduce((sum, s) => {
    const f = s.bold ? fonts.bold : s.italic ? fonts.italic : fonts.reg
    return sum + f.widthOfTextAtSize(s.text, size)
  }, 0)
}

/**
 * Parse a description string (with \n, **bold**, _italic_, • / - bullet prefix)
 * into wrapped RichLines for PDF rendering.
 */
export function parseRichDesc(
  text: string,
  fonts: Fonts,
  size: number,
  maxWidth: number,
): RichLine[] {
  if (!text.trim()) return []

  // Sanitize before measurement — pdf-lib throws on widthOfTextAtSize for non-WinAnsi chars
  const cleaned = text.replace(/[^\x20-\xFF\n]/g, ' ')

  const BULLET_PREFIX = fonts.reg.widthOfTextAtSize('- ', size) + 2
  const out: RichLine[] = []

  for (const rawLine of cleaned.split('\n')) {
    const line     = rawLine.trimEnd()
    const isBullet = line.startsWith('• ') || line.startsWith('- ')
    const content  = isBullet ? line.slice(2) : line
    const wrapW    = maxWidth - (isBullet ? BULLET_PREFIX : 0)

    if (!content.trim() && !isBullet) {
      out.push({ segments: [], bullet: false, indented: false })
      continue
    }

    const words = content.split(' ')
    let curSegs:  RichSeg[] = []
    let curWidth  = 0
    let firstLine = true

    const flush = (bullet: boolean, indented: boolean) => {
      if (curSegs.length > 0) {
        out.push({ segments: mergeSegs(curSegs), bullet, indented })
        curSegs  = []
        curWidth = 0
      }
    }

    for (const word of words) {
      if (!word) continue
      const wordSegs  = parseInline(word + ' ')
      const wordWidth = segWidth(wordSegs, fonts, size)

      if (curWidth + wordWidth > wrapW && curSegs.length > 0) {
        flush(isBullet && firstLine, isBullet && !firstLine)
        firstLine = false
      }
      curSegs  = [...curSegs, ...wordSegs]
      curWidth += wordWidth
    }
    flush(isBullet && firstLine, isBullet && !firstLine)
  }

  return out
}

/** Draw one RichLine at (x, y). */
export function drawRichLine(
  page: PDFPage,
  line: RichLine,
  x: number, y: number,
  fonts: Fonts,
  size: number,
  color: ReturnType<typeof rgb>,
): void {
  if (line.segments.length === 0) return

  let cx = x
  const bulletW = fonts.reg.widthOfTextAtSize('- ', size) + 2

  if (line.bullet) {
    page.drawText('- ', { x: cx, y, size, font: fonts.reg, color })
    cx += fonts.reg.widthOfTextAtSize('- ', size)
  } else if (line.indented) {
    cx += bulletW
  }

  for (const seg of line.segments) {
    const font = seg.bold ? fonts.bold : seg.italic ? fonts.italic : fonts.reg
    const safe = seg.text.replace(/[\r\n\t]/g, ' ').replace(/[^\x20-\xFF]/g, ' ')
    if (!safe) continue
    page.drawText(safe, { x: cx, y, size, font, color })
    cx += font.widthOfTextAtSize(safe, size)
  }
}

/** Count how many rendered lines a description will produce (for rowH calculation). */
export function richLineCount(
  text: string,
  fonts: Fonts,
  size: number,
  maxWidth: number,
): number {
  return parseRichDesc(text, fonts, size, maxWidth).length || 1
}
