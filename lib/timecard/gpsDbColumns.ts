import type { GpsPoint } from '@/lib/types/employee-timesheet.types'

export type GpsLatLngColumns = {
  gps_start_lat: number | null
  gps_start_lng: number | null
  gps_end_lat: number | null
  gps_end_lng: number | null
}

function finite(n: unknown): number | null {
  if (n == null || n === '') return null
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : null
}

/** Build denormalised columns from JSON points (used on upsert). */
export function latLngColumnsFromPoints(
  gps_start: GpsPoint | null | undefined,
  gps_end: GpsPoint | null | undefined
): GpsLatLngColumns {
  return {
    gps_start_lat: gps_start ? finite(gps_start.lat) : null,
    gps_start_lng: gps_start ? finite(gps_start.lng) : null,
    gps_end_lat: gps_end ? finite(gps_end.lat) : null,
    gps_end_lng: gps_end ? finite(gps_end.lng) : null,
  }
}

/** Prefer explicit columns when present (e.g. backfilled), else JSONB. */
export function mergeGpsPointFromRow(
  json: unknown,
  latCol: unknown,
  lngCol: unknown
): GpsPoint | null {
  const la = finite(latCol)
  const ln = finite(lngCol)
  if (la != null && ln != null) return { lat: la, lng: ln }
  if (!json || typeof json !== 'object') return null
  const o = json as { lat?: unknown; lng?: unknown }
  const lat = finite(o.lat)
  const lng = finite(o.lng)
  if (lat != null && lng != null) return { lat, lng }
  return null
}

export function warnIfIdenticalStartEnd(col: GpsLatLngColumns): void {
  const a = col.gps_start_lat
  const b = col.gps_start_lng
  const cLat = col.gps_end_lat
  const d = col.gps_end_lng
  if (a == null || b == null || cLat == null || d == null) return
  if (Math.abs(a - cLat) < 1e-7 && Math.abs(b - d) < 1e-7) {
    console.warn('[gps] Start and end GPS are identical — verify capture timing')
  }
}
