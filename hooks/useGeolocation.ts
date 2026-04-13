'use client'

import { useCallback, useState } from 'react'

export type GeoFix = {
  lat: number
  lng: number
  accuracy: number | null
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getCurrentPosition = useCallback(
    (options?: PositionOptions): Promise<GeoFix | null> => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setError('Geolocation not available')
        return Promise.resolve(null)
      }
      setLoading(true)
      setError(null)
      return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
          pos => {
            setLoading(false)
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy == null ? null : pos.coords.accuracy,
            })
          },
          err => {
            setLoading(false)
            setError(err.message || 'Location error')
            resolve(null)
          },
          {
            enableHighAccuracy: true,
            timeout: 25_000,
            maximumAge: 0,
            ...options,
          },
        )
      })
    },
    [],
  )

  return { getCurrentPosition, loading, error, clearError: () => setError(null) }
}
