type OsrmJson = {
  routes?: Array<{ duration?: number | string }>
  code?: string
}

type LatLng = { lat: number; lng: number }

/**
 * One OSRM driving route: origin → destination (seconds).
 */
async function fetchDrivingRouteDurationSeconds(origin: LatLng, destination: LatLng): Promise<number | null> {
  try {
    const destLat = Number(destination.lat)
    const destLng = Number(destination.lng)
    const originLat = Number(origin.lat)
    const originLng = Number(origin.lng)

    if (![destLat, destLng, originLat, originLng].every(Number.isFinite)) {
      return null
    }

    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`

    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })

    const text = await res.text()
    let data: OsrmJson
    try {
      data = JSON.parse(text) as OsrmJson
    } catch {
      return null
    }

    if (!res.ok || !data.routes || data.routes.length === 0) {
      return null
    }

    const raw = data.routes[0]?.duration
    const seconds = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(seconds)) {
      return null
    }

    return seconds
  } catch {
    return null
  }
}

/**
 * One-way driving time (minutes) between two coordinates (OSRM).
 */
export async function getDrivingMinutesOneWay(origin: LatLng, destination: LatLng): Promise<number> {
  const seconds = await fetchDrivingRouteDurationSeconds(origin, destination)
  if (seconds === null) {
    return 0
  }
  return Math.max(0, Math.round(seconds / 60))
}

/**
 * Round-trip driving time (minutes): factory → job → factory.
 * Uses one OSRM request for outbound duration and doubles it (symmetric estimate).
 */
export async function getTravelTime(origin: LatLng, destination: LatLng): Promise<number> {
  const oneWay = await getDrivingMinutesOneWay(origin, destination)
  return oneWay * 2
}
