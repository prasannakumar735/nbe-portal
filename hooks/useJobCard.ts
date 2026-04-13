'use client'

import { useCallback, useEffect, useState } from 'react'
import type { JobCardDetailResponse } from '@/lib/job-cards/types'

export function useJobCard(eventId: string | null) {
  const [data, setData] = useState<JobCardDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!eventId) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const u = new URL('/api/job-cards', window.location.origin)
      u.searchParams.set('event_id', eventId)
      u.searchParams.set('ensure', 'true')
      const res = await fetch(u.toString(), { credentials: 'same-origin' })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || 'Failed to load job card')
      }
      const json = (await res.json()) as JobCardDetailResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}

export function useJobCardById(jobCardId: string | null) {
  const [data, setData] = useState<JobCardDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!jobCardId?.trim()) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/job-cards/${jobCardId}`, { credentials: 'same-origin' })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || 'Failed to load job card')
      }
      const json = (await res.json()) as JobCardDetailResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [jobCardId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
