/** Normalizes stored time strings to HH:mm for PDF labels. */
export function formatMaintenancePdfTime(s: string): string {
  if (!s) return ''
  const part = String(s).trim()
  if (part.length >= 5) return part.slice(0, 5)
  return part
}
