'use client'

import { useCallback, useState } from 'react'
import { BASE_LOCATION } from '@/lib/constants'
import { getCoordinates } from '@/lib/location'
import { getTravelTime } from '@/lib/travel'

export type LatLng = { lat: number; lng: number }

export type TravelComputeResult = {
  coords: { lat: number; lng: number } | null
  /** Round-trip driving time factory → job → factory (minutes). */
  travel_minutes: number
  /** @deprecated use travel_minutes */
  minutes: number
}

export function useTravelTime() {
  const [travelMinutes, setTravelMinutes] = useState(0)
  const [loadingTravel, setLoadingTravel] = useState(false)
  const [travelError, setTravelError] = useState<string | null>(null)

  const computeFromLocation = useCallback(async (locationText: string, isFullDay: boolean): Promise<TravelComputeResult> => {
    setTravelError(null)
    if (isFullDay) {
      setTravelMinutes(0)
      return { coords: null, travel_minutes: 0, minutes: 0 }
    }
    const q = locationText.trim()
    if (!q) {
      setTravelMinutes(0)
      return { coords: null, travel_minutes: 0, minutes: 0 }
    }

    setLoadingTravel(true)
    try {
      const geo = await getCoordinates(q)
      if (!geo.ok) {
        setTravelMinutes(0)
        if (geo.reason === 'outside_australia') {
          setTravelError('That location appears outside Australia. Try a suburb and state (e.g. Epping VIC).')
        } else if (geo.reason === 'not_found') {
          setTravelError('Could not find that address')
        } else if (geo.reason === 'empty') {
          setTravelError(null)
        } else {
          setTravelError('Could not look up that address')
        }
        return { coords: null, travel_minutes: 0, minutes: 0 }
      }

      const coords = { lat: geo.lat, lng: geo.lng }
      const mins = await getTravelTime(BASE_LOCATION, coords)
      setTravelMinutes(mins)
      return { coords, travel_minutes: mins, minutes: mins }
    } catch {
      setTravelMinutes(0)
      return { coords: null, travel_minutes: 0, minutes: 0 }
    } finally {
      setLoadingTravel(false)
    }
  }, [])

  /** Use when lat/lng are already known (e.g. client_locations row) — skips geocoding. */
  const computeTravelFromCoords = useCallback(async (coords: LatLng | null, isFullDay: boolean): Promise<number> => {
    setTravelError(null)
    if (isFullDay || !coords) {
      setTravelMinutes(0)
      return 0
    }
    setLoadingTravel(true)
    try {
      const mins = await getTravelTime(BASE_LOCATION, coords)
      setTravelMinutes(mins)
      return mins
    } catch {
      setTravelMinutes(0)
      return 0
    } finally {
      setLoadingTravel(false)
    }
  }, [])

  const totalMinutesFor = useCallback((durationMinutes: number, travel: number, isFullDay: boolean) => {
    if (isFullDay) return 0
    return Math.max(0, durationMinutes + travel)
  }, [])

  return {
    travelMinutes,
    setTravelMinutes,
    loadingTravel,
    travelError,
    setTravelError,
    computeFromLocation,
    computeTravelFromCoords,
    totalMinutesFor,
  }
}
