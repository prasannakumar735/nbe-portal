/** Propagated from middleware — Edge-safe UUID per HTTP request. */
export const NBE_REQUEST_ID_HEADER = 'x-nbe-request-id'

const UA_MAX = 240

/** Truncate User-Agent for logs (no PII beyond what clients send). */
export function truncateUserAgent(ua: string | null | undefined): string | undefined {
  const t = String(ua ?? '').trim()
  if (!t) return undefined
  return t.length > UA_MAX ? `${t.slice(0, UA_MAX)}…` : t
}

export function getCorrelationIdFromRequest(request: { headers: Headers }): string | undefined {
  const h = request.headers
  return (
    h.get(NBE_REQUEST_ID_HEADER)?.trim() ||
    h.get('x-vercel-id')?.trim() ||
    h.get('x-request-id')?.trim() ||
    h.get('cf-ray')?.trim() ||
    undefined
  )
}
