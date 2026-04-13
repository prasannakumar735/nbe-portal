/**
 * Resolve a free-text address to coordinates via Nominatim (proxied by /api/calendar/geocode).
 * Results are restricted to Australia; invalid or out-of-bounds coordinates are rejected.
 */

export type GeocodeOutcome =
  | { ok: true; lat: number; lng: number }
  | {
      ok: false
      reason: 'empty' | 'not_found' | 'invalid_coords' | 'outside_australia' | 'server_error'
    }

export async function getCoordinates(address: string): Promise<GeocodeOutcome> {
  const q = address.trim()
  if (!q) {
    return { ok: false, reason: 'empty' }
  }

  const url = `/api/calendar/geocode?q=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
    })

    const data = (await res.json()) as {
      error?: string
      lat?: unknown
      lng?: unknown
    }

    if (res.status === 422 && data?.error === 'not_in_australia') {
      return { ok: false, reason: 'outside_australia' }
    }

    if (!res.ok) {
      if (res.status === 404) {
        return { ok: false, reason: 'not_found' }
      }
      return { ok: false, reason: 'server_error' }
    }

    const lat = typeof data.lat === 'number' ? data.lat : parseFloat(String(data.lat ?? ''))
    const lng = typeof data.lng === 'number' ? data.lng : parseFloat(String(data.lng ?? ''))

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, reason: 'invalid_coords' }
    }

    if (lat > 0) {
      return { ok: false, reason: 'outside_australia' }
    }

    return { ok: true, lat, lng }
  } catch {
    return { ok: false, reason: 'server_error' }
  }
}
