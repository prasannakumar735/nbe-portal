/**
 * Google Places API (New) — server-only business discovery.
 * Requires GOOGLE_MAPS_API_KEY (never expose to the client).
 */

import type { BusinessResult } from '@/lib/sales/types/business.types'

const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText'
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

/** Places SearchText field mask (plus nextPageToken for pagination). */
const PLACES_SEARCH_TEXT_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.location',
  'places.primaryType',
  'places.googleMapsUri',
  'nextPageToken',
].join(',')

const PAGE_TOKEN_DELAY_MS = 2_000
const MAX_RETRIES = 4
const INITIAL_BACKOFF_MS = 500
const GEOCODE_RADIUS_METERS = 8_000
const LOG_PREFIX = '[googlePlacesProvider]'

export class GooglePlacesProviderError extends Error {
  readonly statusCode?: number

  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'GooglePlacesProviderError'
    this.statusCode = statusCode
  }
}

type LatLng = { latitude: number; longitude: number }

type PlacesTextSearchResponse = {
  places?: GooglePlace[]
  nextPageToken?: string
  error?: { message?: string; status?: string; code?: number }
}

type GooglePlace = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  websiteUri?: string
  nationalPhoneNumber?: string
  googleMapsUri?: string
  primaryType?: string
  location?: { latitude?: number; longitude?: number }
}

function getGoogleMapsApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (!key) {
    throw new GooglePlacesProviderError(
      'GOOGLE_MAPS_API_KEY is not configured. Set it in server environment variables.',
    )
  }
  return key
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503
}

function redactUrl(url: string): string {
  return url.replace(/([?&]key=)[^&]+/gi, '$1[REDACTED]')
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  label: string,
): Promise<Response> {
  const method = init.method ?? 'GET'
  console.info(`${LOG_PREFIX} Google request URL`, {
    label,
    method,
    url: redactUrl(url),
  })

  let lastError: Error | undefined
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { ...init, cache: 'no-store' })
      console.info(`${LOG_PREFIX} Google response status`, {
        label,
        status: res.status,
        ok: res.ok,
        attempt,
      })
      if (res.ok) return res
      if (isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * 2 ** attempt
        await sleep(backoff)
        continue
      }
      const snippet = await res.text().catch(() => '')
      throw new GooglePlacesProviderError(
        `${label} failed (${res.status})${snippet ? `: ${snippet.slice(0, 200)}` : ''}`,
        res.status,
      )
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (error instanceof GooglePlacesProviderError) throw error
      if (attempt < MAX_RETRIES) {
        await sleep(INITIAL_BACKOFF_MS * 2 ** attempt)
        continue
      }
    }
  }
  throw lastError ?? new GooglePlacesProviderError(`${label} failed after retries.`)
}

/** Geocode an Australian postcode for locationBias (same API key as Places). */
export async function geocodeAustralianPostcode(postcode: string): Promise<LatLng | null> {
  const key = getGoogleMapsApiKey()
  const url = new URL(GEOCODE_URL)
  url.searchParams.set('address', `${postcode} Australia`)
  url.searchParams.set('components', `country:AU|postal_code:${postcode}`)
  url.searchParams.set('key', key)

  const res = await fetchWithRetry(url.toString(), { method: 'GET' }, 'Geocoding')
  const data = (await res.json()) as {
    status: string
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>
  }
  if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
    return null
  }
  const loc = data.results[0].geometry.location
  if (loc.lat == null || loc.lng == null) return null
  return { latitude: loc.lat, longitude: loc.lng }
}

/** Parse street + suburb from a typical AU formatted address. */
export function parseAustralianFormattedAddress(
  formattedAddress: string,
  postcode: string,
): { address: string; suburb: string } {
  const parts = formattedAddress.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    return { address: formattedAddress.trim(), suburb: '' }
  }

  let suburb = ''
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    if (/^Australia$/i.test(part)) continue
    const statePost = part.match(/^(.+?)\s+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}$/i)
    if (statePost) {
      suburb = statePost[1]?.trim() ?? ''
      break
    }
    if (part.includes(postcode)) {
      const withoutPost = part.replace(new RegExp(`\\b${postcode}\\b`), '').trim()
      const m = withoutPost.match(/^(.+?)\s+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)$/i)
      suburb = m?.[1]?.trim() ?? withoutPost.replace(/\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)$/i, '').trim()
      break
    }
  }

  const address = parts[0] ?? formattedAddress.trim()
  return { address, suburb }
}

function placeIdFromResourceName(id: string | undefined): string | null {
  if (!id?.trim()) return null
  const trimmed = id.trim()
  if (trimmed.startsWith('places/')) return trimmed.slice('places/'.length)
  return trimmed
}

function mapPlaceToBusinessResult(
  place: GooglePlace,
  postcode: string,
  category: string,
): BusinessResult | null {
  const website = place.websiteUri?.trim()
  if (!website) return null

  const name = place.displayName?.text?.trim()
  const formattedAddress = place.formattedAddress?.trim()
  if (!name || !formattedAddress) return null

  const placeId = placeIdFromResourceName(place.id)
  if (!placeId) return null

  const { address, suburb } = parseAustralianFormattedAddress(formattedAddress, postcode)
  const lat = place.location?.latitude
  const lng = place.location?.longitude

  return {
    company_name: name,
    address,
    suburb,
    postcode,
    website,
    phone: place.nationalPhoneNumber?.trim() || null,
    category,
    source: 'google_maps',
    raw_payload: {
      provider: 'google_places',
      place_id: placeId,
      name,
      formatted_address: formattedAddress,
      website_uri: website,
      national_phone_number: place.nationalPhoneNumber?.trim() || null,
      google_maps_uri: place.googleMapsUri?.trim() || null,
      primary_type: place.primaryType?.trim() || null,
      latitude: lat ?? null,
      longitude: lng ?? null,
      search_category: category,
    },
  }
}

async function searchTextPage(
  apiKey: string,
  textQuery: string,
  locationBias: LatLng | null,
  pageToken?: string,
): Promise<PlacesTextSearchResponse> {
  const body: Record<string, unknown> = { textQuery }
  if (pageToken) {
    body.pageToken = pageToken
  }
  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.latitude, longitude: locationBias.longitude },
        radius: GEOCODE_RADIUS_METERS,
      },
    }
  }

  console.info(`${LOG_PREFIX} Places searchText request`, {
    url: PLACES_SEARCH_TEXT_URL,
    textQuery,
    paginated: Boolean(pageToken),
  })

  const res = await fetchWithRetry(
    PLACES_SEARCH_TEXT_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACES_SEARCH_TEXT_FIELD_MASK,
      },
      body: JSON.stringify(body),
    },
    'Places searchText',
  )

  const data = (await res.json()) as PlacesTextSearchResponse
  if (data.error?.message) {
    const code = data.error.code
    throw new GooglePlacesProviderError(data.error.message, code)
  }
  return data
}

async function searchCategoryPlaces(
  apiKey: string,
  postcode: string,
  category: string,
  locationBias: LatLng | null,
  seenPlaceIds: Set<string>,
  out: BusinessResult[],
): Promise<void> {
  const textQuery = `${category} in ${postcode} Australia`
  let pageToken: string | undefined

  for (;;) {
    if (pageToken) {
      await sleep(PAGE_TOKEN_DELAY_MS)
    }

    const data = await searchTextPage(apiKey, textQuery, locationBias, pageToken)
    for (const place of data.places ?? []) {
      const placeId = placeIdFromResourceName(place.id)
      if (!placeId || seenPlaceIds.has(placeId)) continue
      const mapped = mapPlaceToBusinessResult(place, postcode, category)
      if (!mapped) continue
      seenPlaceIds.add(placeId)
      out.push(mapped)
    }

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
}

/**
 * Search industrial-style businesses near an Australian postcode via Places API (New).
 * Only returns places with a website. Dedupes by Google place id across categories/pages.
 */
export async function searchGooglePlacesBusinesses(
  postcode: string,
  categories: string[],
): Promise<BusinessResult[]> {
  const normalizedPostcode = postcode.trim()
  const pool = categories.length > 0 ? categories : ['warehouse']
  console.info(`${LOG_PREFIX} search start`, {
    postcode: normalizedPostcode,
    categories: pool.length,
  })
  const apiKey = getGoogleMapsApiKey()
  const locationBias = await geocodeAustralianPostcode(normalizedPostcode)

  const seenPlaceIds = new Set<string>()
  const results: BusinessResult[] = []
  let categoriesFailed = 0
  let authError: GooglePlacesProviderError | undefined

  for (const category of pool) {
    try {
      await searchCategoryPlaces(
        apiKey,
        normalizedPostcode,
        category,
        locationBias,
        seenPlaceIds,
        results,
      )
    } catch (error) {
      if (error instanceof GooglePlacesProviderError) {
        if (error.statusCode === 401 || error.statusCode === 403) {
          authError = error
          break
        }
        categoriesFailed += 1
        console.warn(
          `[googlePlacesProvider] category "${category}" failed for ${normalizedPostcode}:`,
          error.message,
        )
        continue
      }
      throw error
    }
  }

  if (authError) throw authError
  if (categoriesFailed === pool.length) {
    throw new GooglePlacesProviderError(
      `All category searches failed for postcode ${normalizedPostcode}.`,
    )
  }

  console.info(`${LOG_PREFIX} search complete`, {
    postcode: normalizedPostcode,
    businessesReturned: results.length,
  })

  const seenNameKeys = new Set<string>()
  const deduped: BusinessResult[] = []
  for (const r of results) {
    const key = `${r.company_name.trim().toLowerCase()}|${r.postcode.trim()}`
    if (seenNameKeys.has(key)) continue
    seenNameKeys.add(key)
    deduped.push(r)
  }

  if (deduped.length !== results.length) {
    console.info(`${LOG_PREFIX} deduped by company_name+postcode`, {
      before: results.length,
      after: deduped.length,
    })
  }

  return deduped
}
