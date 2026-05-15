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
  if (seconds === null) return { minutes: 0, ok: false }
  return { minutes: Math.max(0, Math.round(seconds / 60)) * 2, ok: true }
}
