'use client'

import { useCallback, useState } from 'react'

export type ReverseResult = {
  display: string
  formattedAddress: string
  suburb: string | null
}

export function useReverseGeocoding() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reverse = useCallback(async (lat: number, lng: number): Promise<ReverseResult | null> => {
    setLoading(true)
    setError(null)
    try {
      const u = new URL('/api/geocode/reverse', window.location.origin)
      u.searchParams.set('lat', String(lat))
      u.searchParams.set('lng', String(lng))
      const res = await fetch(u.toString(), { credentials: 'same-origin' })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || 'Reverse geocode failed')
      }
      const data = (await res.json()) as ReverseResult
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reverse geocode failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { reverse, loading, error }
}
