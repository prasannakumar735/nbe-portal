/**
 * Reverse geocoding for timesheet GPS points.
 * Default: OpenStreetMap Nominatim (no API key; respect usage policy — call sparingly).
 * Optional: Google Geocoding API when GOOGLE_MAPS_GEOCODING_API_KEY is set.
 */

import type { GpsAddressMeta } from '@/lib/types/employee-timesheet.types'

export type ReverseGeocodeResult =
  | { ok: true; meta: GpsAddressMeta }
  | { ok: false; reason?: string }

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'

function nominatimUserAgent(): string {
  return (
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    'nbe-portal/0.1.0 (employee timecard; contact via organisation admin)'
  )
}

function pickSuburb(addr: Record<string, string | undefined>): string | null {
  const v =
    addr.suburb ||
    addr.city_district ||
    addr.neighbourhood ||
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.municipality
  return v ? String(v) : null
}

function parseNominatimBody(data: {
  display_name?: string
  address?: Record<string, string>
}): GpsAddressMeta | null {
  const formatted = data.display_name?.trim()
  if (!formatted) return null
  const a = data.address ?? {}
  return {
    formattedAddress: formatted,
    suburb: pickSuburb(a as Record<string, string | undefined>),
    state: a.state || a.region || null,
    postcode: a.postcode || null,
    country: a.country || null,
  }
}

async function reverseGeocodeGoogle(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const key = process.env.GOOGLE_MAPS_GEOCODING_API_KEY
  if (!key) return { ok: false, reason: 'no_google_key' }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('latlng', `${lat},${lng}`)
  url.searchParams.set('key', key)

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) return { ok: false, reason: `google_http_${res.status}` }

  const data = (await res.json()) as {
    status: string
    results?: Array<{ formatted_address?: string; address_components?: Array<{ long_name: string; short_name: string; types: string[] }> }>
  }
  if (data.status !== 'OK' || !data.results?.[0]) {
    return { ok: false, reason: data.status || 'google_zero_results' }
  }

  const r = data.results[0]
  const formatted = r.formatted_address?.trim()
  if (!formatted) return { ok: false, reason: 'google_no_formatted' }

  let suburb: string | null = null
  let state: string | null = null
  let postcode: string | null = null
  let country: string | null = null

  for (const c of r.address_components ?? []) {
    const types = c.types
    if (types.includes('locality') || types.includes('sublocality') || types.includes('neighborhood')) {
      if (!suburb) suburb = c.long_name
    }
    if (types.includes('administrative_area_level_1')) state = c.long_name
    if (types.includes('postal_code')) postcode = c.long_name
    if (types.includes('country')) country = c.long_name
  }

  return {
    ok: true,
    meta: {
      formattedAddress: formatted,
      suburb,
      state,
      postcode,
      country,
    },
  }
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const url = new URL(NOMINATIM_URL)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': nominatimUserAgent(),
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) return { ok: false, reason: `nominatim_http_${res.status}` }

  const data = (await res.json()) as {
    error?: string
    display_name?: string
    address?: Record<string, string>
  }
  if (data.error) return { ok: false, reason: data.error }

  const meta = parseNominatimBody(data)
  if (!meta) return { ok: false, reason: 'nominatim_parse' }

  return { ok: true, meta }
}

/**
 * Resolve coordinates to a formatted address and structured fields.
 * Tries Google when GOOGLE_MAPS_GEOCODING_API_KEY is set; otherwise Nominatim.
 */
export async function getAddressFromLatLng(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'invalid_coords' }
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: 'out_of_range' }
  }

  if (process.env.GOOGLE_MAPS_GEOCODING_API_KEY) {
    const g = await reverseGeocodeGoogle(lat, lng)
    if (g.ok) return g
  }

  return reverseGeocodeNominatim(lat, lng)
}

/** Delay between Nominatim calls when batching (usage policy ~1 req/s). */
export const NOMINATIM_MIN_INTERVAL_MS = 1100

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
