import { NextRequest, NextResponse } from 'next/server'
import { GEO_USER_AGENT } from '@/lib/constants'

export type GeocodeSuggestion = {
  label: string
  lat: number
  lng: number
}

/** Simple server-side cache (per runtime instance) — single best match. */
const geocodeCache = new Map<string, { lat: number; lng: number }>()
/** Cache for autocomplete lists (different keys than single-geocode). */
const suggestCache = new Map<string, GeocodeSuggestion[]>()
const MAX_CACHE = 150
const MAX_SUGGEST_CACHE = 120

function trimCaches() {
  while (geocodeCache.size > MAX_CACHE) {
    const first = geocodeCache.keys().next().value as string | undefined
    if (first === undefined) break
    geocodeCache.delete(first)
  }
  while (suggestCache.size > MAX_SUGGEST_CACHE) {
    const first = suggestCache.keys().next().value as string | undefined
    if (first === undefined) break
    suggestCache.delete(first)
  }
}

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

function buildSearchQuery(raw: string): string {
  return /\baustralia\b/i.test(raw) ? raw : `${raw}, Victoria, Australia`
}

/**
 * Proxy Nominatim search (avoids browser CORS; sends required User-Agent).
 * Restricts results to Australia and biases ambiguous names toward Victoria.
 *
 * Single: GET ?q=... → { lat, lng }
 * Suggest: GET ?q=...&suggest=1 → { suggestions: { label, lat, lng }[] }
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('q')?.trim()
  if (!raw) {
    return NextResponse.json({ error: 'Missing q' }, { status: 400 })
  }

  const wantSuggest =
    req.nextUrl.searchParams.get('suggest') === '1' || req.nextUrl.searchParams.get('suggest') === 'true'

  const searchQuery = buildSearchQuery(raw)

  if (wantSuggest) {
    const cacheKey = `suggest:${searchQuery.toLowerCase()}`
    const cached = suggestCache.get(cacheKey)
    if (cached !== undefined) {
      return NextResponse.json({ suggestions: cached })
    }

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', searchQuery)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '8')
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

      const rows = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
      const suggestions: GeocodeSuggestion[] = []
      for (const row of rows) {
        const lat = parseFloat(String(row.lat ?? ''))
        const lng = parseFloat(String(row.lon ?? ''))
        const label = String(row.display_name ?? '').trim()
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !label) continue
        if (!isWithinAustralia(lat, lng)) continue
        suggestions.push({ label, lat, lng })
        if (suggestions.length >= 8) break
      }

      suggestCache.set(cacheKey, suggestions)
      trimCaches()
      return NextResponse.json({ suggestions })
    } catch {
      return NextResponse.json({ error: 'Geocode error' }, { status: 502 })
    }
  }

  // --- single-result mode (backward compatible with lib/location.ts) ---
  const cacheKey = searchQuery.toLowerCase()
  const cached = geocodeCache.get(cacheKey)
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

    geocodeCache.set(cacheKey, { lat, lng })
    trimCaches()
    return NextResponse.json({ lat, lng })
  } catch {
    return NextResponse.json({ error: 'Geocode error' }, { status: 502 })
  }
}
