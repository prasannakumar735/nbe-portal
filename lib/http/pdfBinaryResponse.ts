import { NextResponse } from 'next/server'

/**
 * Return a raw PDF body for App Router handlers.
 * Uses Node `Buffer` (not JSON/base64) and sets Content-Length for reliable downloads.
 */
export function createPdfBinaryResponse(
  pdfBytes: Uint8Array | Buffer,
  options: {
    contentDisposition: string
    cacheControl?: string
    extraHeaders?: Record<string, string>
  },
): NextResponse {
  const pdfBuffer = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes)
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' })
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': options.contentDisposition,
      'Content-Length': String(blob.size),
      'X-Content-Type-Options': 'nosniff',
      ...(options.cacheControl ? { 'Cache-Control': options.cacheControl } : {}),
      ...options.extraHeaders,
    },
  })
}
