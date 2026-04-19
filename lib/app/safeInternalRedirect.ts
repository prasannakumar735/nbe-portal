/** Only same-origin path redirects — blocks protocol-relative and external URLs. */
export function safeInternalRedirectPath(raw: string | undefined | null): string | null {
  if (raw == null) return null
  const t = String(raw).trim()
  if (!t.startsWith('/') || t.startsWith('//')) return null
  return t
}
