/** e.g. "09:00 → 17:00 (30m)" */
export function formatEntryTimeRange(start: string, end: string, breakMinutes: number): string {
  const startS = String(start ?? '')
    .trim()
    .slice(0, 5) || '—'
  const endS = String(end ?? '')
    .trim()
    .slice(0, 5) || '—'
  const br = Math.max(0, Math.round(Number(breakMinutes) || 0))
  const breakPart = br > 0 ? ` (${br}m)` : ''
  return `${startS} → ${endS}${breakPart}`
}
