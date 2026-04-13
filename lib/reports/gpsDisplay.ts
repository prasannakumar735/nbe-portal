import type { GpsReportRow } from '@/lib/reports/types'

/** Detect "lat, lng" coordinate strings stored as text */
function looksLikeCoordPair(s: string): boolean {
  const t = s.trim()
  const parts = t.split(',').map(x => x.trim())
  if (parts.length !== 2) return false
  const a = Number(parts[0])
  const b = Number(parts[1])
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180
}

/** Short label for table cells: locality-first, avoids misleading "12 → 12" from coord pairs */
export function shortenAddressLine(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s || s === '—') return ''
  if (looksLikeCoordPair(s)) {
    const [la, lo] = s.split(',').map(x => x.trim())
    return `${Number(la).toFixed(4)}, ${Number(lo).toFixed(4)}`
  }
  const first = s.split(',')[0]?.trim() || s
  if (first.length > 40) return `${first.slice(0, 37)}…`
  return first
}

/** Two comma-separated decimal degrees (avoids treating "12, Footscray" as lat/lng). */
function coordPairFromSegments(segments: string[]): { lat: number; lng: number } | null {
  if (segments.length < 2) return null
  const raw0 = segments[0]!.trim()
  const raw1 = segments[1]!.trim()
  if (!/^-?\d+\.\d+$/.test(raw0) || !/^-?\d+\.\d+$/.test(raw1)) return null
  const la = Number(raw0)
  const lo = Number(raw1)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null
  return { lat: la, lng: lo }
}

/** Leading token is only a small street/building number (e.g. "12" from "12, Footscray, VIC") — not a full street line. */
function isBareLeadingNumberToken(token: string): boolean {
  const t = token.trim()
  return t.length > 0 && t.length <= 5 && /^\d{1,4}[a-z]?$/i.test(t) && !/\s/.test(t)
}

/**
 * Human-readable label for Reports GPS columns.
 * Avoids showing bare "12" when geocoder returns "12, Suburb, …" or coords leaked into the address field.
 */
export function formatLocationForReport(
  address: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined
): string {
  const fallbackCoords = () =>
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      : '—'

  const a = String(address ?? '').trim()
  if (!a || a === '—') {
    return fallbackCoords()
  }

  // Whole string is "lat, lng"
  if (looksLikeCoordPair(a)) {
    const [la, lo] = a.split(',').map(x => x.trim())
    return `${Number(la).toFixed(4)}, ${Number(lo).toFixed(4)}`
  }

  const segments = a.split(',').map(x => x.trim()).filter(Boolean)

  // Geocoder returned only a house number — use stored GPS
  if (segments.length === 1 && isBareLeadingNumberToken(segments[0]!)) {
    return fallbackCoords()
  }

  // "lat, lng, Australia, …" in address text — prefer row coords when present
  const leadCoord = coordPairFromSegments(segments)
  if (leadCoord) {
    const fb = fallbackCoords()
    return fb !== '—' ? fb : `${leadCoord.lat.toFixed(4)}, ${leadCoord.lng.toFixed(4)}`
  }

  // "12, Footscray, …" — skip bare leading street/building index
  if (segments.length >= 2 && isBareLeadingNumberToken(segments[0]!)) {
    const rest = segments.slice(1).join(', ')
    if (rest.length > 48) return `${rest.slice(0, 45)}…`
    return rest
  }

  const first = segments[0] ?? a
  if (first.length > 48) return `${first.slice(0, 45)}…`
  return first
}

/** "Footscray → Melbourne CBD" style (shortened ends) */
export function shortRouteLabel(start: string, end: string): string {
  const a = shortenAddressLine(start)
  const b = shortenAddressLine(end)
  if (!a && !b) return '—'
  if (!a) return b
  if (!b) return a
  return `${a} → ${b}`
}

/**
 * Single “Location” column for GPS tables: prefer end (destination), then start.
 * Uses the same formatting rules as the former Start/End cells.
 */
export function getGpsPrimaryDisplayLocation(row: GpsReportRow): string {
  const end = formatLocationForReport(row.end_address, row.end_lat, row.end_lng)
  if (end !== '—') return end
  return formatLocationForReport(row.start_address, row.start_lat, row.start_lng)
}

/** Hover / title text with both ends (for tooltips). */
export function getGpsLocationDetailTitle(row: GpsReportRow): string {
  const s = formatLocationForReport(row.start_address, row.start_lat, row.start_lng)
  const e = formatLocationForReport(row.end_address, row.end_lat, row.end_lng)
  return `Start: ${s}\nEnd: ${e}`
}
