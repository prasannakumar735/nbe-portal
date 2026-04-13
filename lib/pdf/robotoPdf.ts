import { readFile } from 'fs/promises'
import path from 'path'
import type { PDFDocument } from 'pdf-lib'

const ROBOTO_DIR = path.join(process.cwd(), 'public', 'fonts', 'roboto')

export type RobotoPdfFonts = {
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>
}

/**
 * Embed Roboto TTFs from /public/fonts/roboto for pdf-lib.
 * Falls back to null if files are missing (e.g. CI without assets).
 */
export async function embedRobotoForPdfLib(pdf: PDFDocument): Promise<RobotoPdfFonts | null> {
  try {
    const regPath = path.join(ROBOTO_DIR, 'ROBOTO-REGULAR.TTF')
    const boldPath = path.join(ROBOTO_DIR, 'ROBOTO-BOLD.TTF')
    const [regularBytes, boldBytes] = await Promise.all([readFile(regPath), readFile(boldPath)])
    const [regular, bold] = await Promise.all([
      pdf.embedFont(regularBytes, { subset: true }),
      pdf.embedFont(boldBytes, { subset: true }),
    ])
    return { regular, bold }
  } catch {
    return null
  }
}
