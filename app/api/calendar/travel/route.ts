import { NextResponse } from 'next/server'
import { BASE_LOCATION } from '@/lib/constants'
import { getTravelTime } from '@/lib/travel'

/**
 * Optional server proxy for OSRM (same logic as {@link getTravelTime} in `lib/travel.ts`).
 * Keeps older cached bundles working if they still call this route; primary path is client → OSRM.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  let originLatRaw = searchParams.get('originLat')
  let originLngRaw = searchParams.get('originLng')
  const destLatRaw = searchParams.get('destLat')
  const destLngRaw = searchParams.get('destLng')

  if (!destLatRaw || !destLngRaw) {
    return NextResponse.json({ travel_minutes: 0 })
  }

  if (!originLatRaw) originLatRaw = String(BASE_LOCATION.lat)
  if (!originLngRaw) originLngRaw = String(BASE_LOCATION.lng)

  const originLat = Number(originLatRaw)
  const originLng = Number(originLngRaw)
  const destLat = Number(destLatRaw)
  const destLng = Number(destLngRaw)

  if (![originLat, originLng, destLat, destLng].every(Number.isFinite)) {
    return NextResponse.json({ travel_minutes: 0 })
  }

  const travel_minutes = await getTravelTime(
    { lat: originLat, lng: originLng },
    { lat: destLat, lng: destLng }
  )
  return NextResponse.json({ travel_minutes })
}
