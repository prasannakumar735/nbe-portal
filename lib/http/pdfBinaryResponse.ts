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
  // Web `Response` body typing expects `Uint8Array`/`ArrayBuffer` in strict TS; Buffer is compatible at runtime.
  const body = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': options.contentDisposition,
      'Content-Length': String(pdfBuffer.length),
      'X-Content-Type-Options': 'nosniff',
      ...(options.cacheControl ? { 'Cache-Control': options.cacheControl } : {}),
      ...options.extraHeaders,
    },
  })
}
