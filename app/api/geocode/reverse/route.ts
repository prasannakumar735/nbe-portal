import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isWithinAustralia } from '@/lib/geocoding/australiaBounds'
import { getAddressFromLatLng } from '@/lib/timecard/reverseGeocode'

export const runtime = 'nodejs'

/**
 * Reverse geocode for Australia GPS points (returns suburb-first display line; no raw coords in label).
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lat = Number(req.nextUrl.searchParams.get('lat'))
  const lng = Number(req.nextUrl.searchParams.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }
  if (!isWithinAustralia(lat, lng)) {
    return NextResponse.json({ error: 'not_in_australia' }, { status: 422 })
  }

  const res = await getAddressFromLatLng(lat, lng)
  if (!res.ok) {
    return NextResponse.json({ error: res.reason ?? 'reverse_failed' }, { status: 502 })
  }

  const suburb = res.meta.suburb?.trim() || null
  const display = suburb || res.meta.formattedAddress.split(',')[0]?.trim() || res.meta.formattedAddress

  return NextResponse.json({
    display,
    formattedAddress: res.meta.formattedAddress,
    suburb,
    state: res.meta.state,
    postcode: res.meta.postcode,
  })
}
