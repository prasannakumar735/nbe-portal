/**
 * Shared display formatting for maintenance reports (portal UI + PDF).
 */

export function formatMaintenanceInteger(n: number): string {
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 }).format(Math.trunc(n))
}

/** Comma-group plain digit strings (e.g. CW/CH mm); pass through other text unchanged. */
export function formatMaintenanceNumericField(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (/^\d+$/.test(t)) return formatMaintenanceInteger(Number(t))
  return t
}

/** Null means omit this segment (no cycles / not entered). */
export function formatDoorCyclesDisplay(cycles: number | undefined | null): string | null {
  const n = Number(cycles)
  if (!(n > 0) || Number.isNaN(n)) return null
  return formatMaintenanceInteger(Math.floor(n))
}

export function isBlankInspectorDoorType(raw: unknown): boolean {
  const s = String(raw ?? '').trim()
  return !s || s.toLowerCase() === 'unspecified'
}

/** Single line under door title — omit segments when there is nothing to show. */
export function buildDoorMetaSummaryLine(door: {
  door_type?: string
  door_cycles?: number
  view_window_visibility?: number
}): string {
  const parts: string[] = []
  const dt = String(door.door_type ?? '').trim()
  if (dt && dt.toLowerCase() !== 'unspecified') {
    parts.push(`Door Type: ${dt}`)
  }
  const cycles = formatDoorCyclesDisplay(door.door_cycles)
  if (cycles) {
    parts.push(`Cycles: ${cycles}`)
  }
  const vw = Number(door.view_window_visibility)
  if (Number.isFinite(vw)) {
    parts.push(`View Window Visibility: ${formatMaintenanceInteger(vw)}%`)
  }
  return parts.join('  |  ')
}
