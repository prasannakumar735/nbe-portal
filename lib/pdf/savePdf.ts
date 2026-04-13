import type { PDFDocument } from 'pdf-lib'

/**
 * Save options tuned for broad reader compatibility (Adobe Acrobat is stricter than browser viewers).
 * @see https://github.com/Hopding/pdf-lib/issues — object streams can cause "damaged" in some Acrobat versions.
 */
const COMPAT_SAVE = {
  useObjectStreams: false,
  addDefaultPage: false,
} as const

export async function savePdfBytes(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save(COMPAT_SAVE)
}

export function assertValidPdfSignature(bytes: Uint8Array, context: string): void {
  if (bytes.length < 8) {
    throw new Error(`${context}: PDF output is empty or truncated`)
  }
  const sig = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!, bytes[4]!)
  if (sig !== '%PDF-') {
    throw new Error(`${context}: Invalid PDF header (expected %PDF-)`)
  }
}
