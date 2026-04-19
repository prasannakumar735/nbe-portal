export class PayloadTooLargeError extends Error {
  readonly status = 413
  constructor(message = 'Payload too large.') {
    super(message)
    this.name = 'PayloadTooLargeError'
  }
}

/**
 * Reject oversized JSON bodies using Content-Length when present.
 * Clients may omit Content-Length; for those cases rely on reverse-proxy limits (e.g. Vercel 4.5MB).
 */
export function assertJsonContentLength(request: { headers: Headers }, maxBytes: number) {
  const raw = request.headers.get('content-length')
  if (!raw) return
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return
  if (n > maxBytes) throw new PayloadTooLargeError()
}
