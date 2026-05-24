type OsrmJson = {
  routes?: Array<{ duration?: number | string }>
  code?: string
  message?: string
}

type LatLng = { lat: number; lng: number }

export type TravelResult = {
  minutes: number
  /** false when OSRM was unreachable or returned no route — lets callers surface an error. */
  ok: boolean
}

const OSRM_TIMEOUT_MS = 10_000

/** Nominal avg speed when OSRM is down (straight-line inflated by winding factor below). km/h */
const FALLBACK_SPEED_KMH = 42

/** Multiply crow-flies km to approximate driving distance (Australian metro — rough heuristic). */
const FALLBACK_DISTANCE_FACTOR = 1.25

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Round-trip minutes when OSRM is unavailable — distance estimate only. */
function estimatedRoundTripMinutes(origin: LatLng, destination: LatLng): number {
  let km = haversineKm(origin, destination) * FALLBACK_DISTANCE_FACTOR
  if (!Number.isFinite(km) || km < 0) km = 0
  /** One-way + return at nominal speed */
  const oneWayMin = (km / FALLBACK_SPEED_KMH) * 60
  const rt = Math.round(oneWayMin * 2)
  return Math.max(0, rt)
}

/**
 * One OSRM driving route: origin → destination (seconds).
 * Returns null + logs on any failure so callers can distinguish 0-distance from error.
 */
async function fetchDrivingRouteDurationSeconds(origin: LatLng, destination: LatLng): Promise<number | null> {
  const destLat = Number(destination.lat)
  const destLng = Number(destination.lng)
  const originLat = Number(origin.lat)
  const originLng = Number(origin.lng)

  if (![destLat, destLng, originLat, originLng].every(Number.isFinite)) {
    return null
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })

    const text = await res.text()
    let data: OsrmJson
    try {
      data = JSON.parse(text) as OsrmJson
    } catch {
      console.error('[travel] OSRM non-JSON response', res.status, text.slice(0, 200))
      return null
    }

    if (!res.ok) {
      console.error('[travel] OSRM HTTP error', res.status, data.code, data.message)
      return null
    }

    if (!data.routes || data.routes.length === 0) {
      console.error('[travel] OSRM no route', data.code, data.message)
      return null
    }

    const raw = data.routes[0]?.duration
    const seconds = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(seconds)) {
      console.error('[travel] OSRM invalid duration', raw)
      return null
    }

    return seconds
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    console.error('[travel] OSRM fetch failed', isTimeout ? 'timeout' : String(err))
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * One-way driving time (minutes) between two coordinates (OSRM).
 */
export async function getDrivingMinutesOneWay(origin: LatLng, destination: LatLng): Promise<number> {
  const seconds = await fetchDrivingRouteDurationSeconds(origin, destination)
  if (seconds === null) return 0
  return Math.max(0, Math.round(seconds / 60))
}

/**
 * Round-trip driving time (minutes): factory → job → factory.
 * Returns { minutes, ok } so callers can distinguish a genuine 0 from an OSRM failure.
 */
export async function getTravelTime(origin: LatLng, destination: LatLng): Promise<TravelResult> {
  const seconds = await fetchDrivingRouteDurationSeconds(origin, destination)
  if (seconds !== null) {
    return { minutes: Math.max(0, Math.round(seconds / 60)) * 2, ok: true }
  }
  const estimate = estimatedRoundTripMinutes(origin, destination)
  if (estimate > 0) {
    console.warn('[travel] OSRM unavailable — using crow-flies estimate for round-trip minutes', estimate)
    return { minutes: estimate, ok: true }
  }
  const straightKm = haversineKm(origin, destination)
  if (straightKm < 0.04) return { minutes: 0, ok: true }

  return { minutes: 0, ok: false }
}
