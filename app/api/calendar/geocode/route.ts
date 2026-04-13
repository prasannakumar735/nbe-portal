import { NextRequest, NextResponse } from 'next/server'
import { GEO_USER_AGENT } from '@/lib/constants'

/** Simple server-side cache (per runtime instance). */
const geocodeCache = new Map<string, { lat: number; lng: number }>()
const MAX_CACHE = 150

/**
 * Rough mainland Australia + Tasmania bounds (excludes remote territories).
 * Nominatim may still return odd points; this rejects obvious hemisphere / bbox mistakes.
 */
function isWithinAustralia(lat: number, lng: number): boolean {
  if (lat > 0) return false
  if (lat < -45 || lat > -9) return false
  if (lng < 110 || lng > 155) return false
  return true
}

function cacheGet(key: string): { lat: number; lng: number } | undefined {
  return geocodeCache.get(key)
}

function cacheSet(key: string, value: { lat: number; lng: number }) {
  geocodeCache.set(key, value)
  while (geocodeCache.size > MAX_CACHE) {
    const first = geocodeCache.keys().next().value as string | undefined
    if (first === undefined) break
    geocodeCache.delete(first)
  }
}

/**
 * Proxy Nominatim search (avoids browser CORS; sends required User-Agent).
 * Restricts results to Australia and biases ambiguous names toward Victoria.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('q')?.trim()
  if (!raw) {
    return NextResponse.json({ error: 'Missing q' }, { status: 400 })
  }

  const searchQuery = /\baustralia\b/i.test(raw) ? raw : `${raw}, Victoria, Australia`
  const cacheKey = searchQuery.toLowerCase()
  const cached = cacheGet(cacheKey)
  if (cached) {
    return NextResponse.json({ lat: cached.lat, lng: cached.lng })
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', searchQuery)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'au')

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': GEO_USER_AGENT,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Geocode failed' }, { status: 502 })
    }

    const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>
    const first = rows[0]
    if (!first?.lat || !first?.lon) {
      return NextResponse.json({ error: 'No results' }, { status: 404 })
    }

    const lat = parseFloat(first.lat)
    const lng = parseFloat(first.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 502 })
    }

    if (!isWithinAustralia(lat, lng)) {
      return NextResponse.json({ error: 'not_in_australia' }, { status: 422 })
    }

    cacheSet(cacheKey, { lat, lng })
    return NextResponse.json({ lat, lng })
  } catch {
    return NextResponse.json({ error: 'Geocode error' }, { status: 502 })
  }
}
