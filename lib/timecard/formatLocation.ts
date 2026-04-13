import type { GpsPoint } from '@/lib/types/employee-timesheet.types'

function normalizeAddress(value: string | null | undefined): string {
  return (value ?? '').trim()
}

/**
 * Human-readable location line for reports and exports.
 *
 * Rules:
 * - Both missing/empty → "No location"
 * - Same start/end (after trim) → single address
 * - Different → "Start → End"
 * - Only one side → that address alone
 */
export function formatLocation(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const a = normalizeAddress(start)
  const b = normalizeAddress(end)

  if (!a && !b) return 'No location'
  if (a && b) {
    if (a === b) return a
    return `${a} → ${b}`
  }
  return a || b
}

/** Haversine distance in metres (WGS84 sphere). */
export function haversineDistanceMeters(p1: GpsPoint, p2: GpsPoint): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(p2.lat - p1.lat)
  const dLng = toRad(p2.lng - p1.lng)
  const lat1 = toRad(p1.lat)
  const lat2 = toRad(p2.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function formatDistanceLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

/** Worst (largest) accuracy value when both points report it. */
function formatAccuracyLabel(gpsStart?: GpsPoint | null, gpsEnd?: GpsPoint | null): string | null {
  const accs = [gpsStart?.accuracy, gpsEnd?.accuracy].filter(
    (x): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0,
  )
  if (accs.length === 0) return null
  const worst = Math.max(...accs)
  return `±${Math.round(worst)} m GPS`
}

/**
 * Same rules as {@link formatLocation}, plus optional suffix when GPS points exist:
 * distance between start/end and a single accuracy line when either point has `accuracy`.
 */
export function formatLocationForExport(
  startAddr: string | null | undefined,
  endAddr: string | null | undefined,
  gpsStart?: GpsPoint | null,
  gpsEnd?: GpsPoint | null,
): string {
  const base = formatLocation(startAddr, endAddr)
  const extras: string[] = []

  if (gpsStart && gpsEnd) {
    const d = haversineDistanceMeters(gpsStart, gpsEnd)
    // Skip noise when start/end are effectively the same place (~same address)
    if (d > 15) {
      const dist = formatDistanceLabel(d)
      if (dist) extras.push(dist)
    }
  }

  const acc = formatAccuracyLabel(gpsStart, gpsEnd)
  if (acc) extras.push(acc)

  if (extras.length === 0) return base
  return `${base} (${extras.join(' · ')})`
}
