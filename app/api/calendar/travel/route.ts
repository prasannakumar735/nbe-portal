import { NextResponse } from 'next/server'
import { BASE_LOCATION } from '@/lib/constants'
import { getTravelTime } from '@/lib/travel'

/**
 * Server proxy for OSRM — keeps router.project-osrm.org off the browser CSP connect-src.
 * Returns { travel_minutes, ok } so clients can distinguish a genuine 0 from an OSRM failure.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  let originLatRaw = searchParams.get('originLat')
  let originLngRaw = searchParams.get('originLng')
  const destLatRaw = searchParams.get('destLat')
  const destLngRaw = searchParams.get('destLng')

  if (!destLatRaw || !destLngRaw) {
    return NextResponse.json({ travel_minutes: 0, ok: false, error: 'missing_dest' })
  }

  if (!originLatRaw) originLatRaw = String(BASE_LOCATION.lat)
  if (!originLngRaw) originLngRaw = String(BASE_LOCATION.lng)

  const originLat = Number(originLatRaw)
  const originLng = Number(originLngRaw)
  const destLat = Number(destLatRaw)
  const destLng = Number(destLngRaw)

  if (![originLat, originLng, destLat, destLng].every(Number.isFinite)) {
    return NextResponse.json({ travel_minutes: 0, ok: false, error: 'invalid_coords' })
  }

  const result = await getTravelTime(
    { lat: originLat, lng: originLng },
    { lat: destLat, lng: destLng }
  )

  if (!result.ok) {
    return NextResponse.json(
      { travel_minutes: 0, ok: false, error: 'osrm_unavailable' },
      { status: 502 }
    )
  }

  return NextResponse.json({ travel_minutes: result.minutes, ok: true })
}
