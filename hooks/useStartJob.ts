'use client'

import { useCallback, useState } from 'react'
import type { JobCardGpsPayload } from '@/lib/job-cards/types'
import { enqueueJobPatch } from '@/lib/offline/fieldSyncDb'

export function useStartJob() {
  const [loading, setLoading] = useState(false)

  const startJob = useCallback(
    async (params: {
      jobId: string
      getPosition: () => Promise<{ lat: number; lng: number; accuracy: number | null } | null>
      reverse: (lat: number, lng: number) => Promise<{ display: string } | null>
      onQueued?: () => void
    }) => {
      const { jobId, getPosition, reverse, onQueued } = params
      setLoading(true)
      try {
        const pos = await getPosition()
        if (!pos) {
          throw new Error('Could not read GPS')
        }
        const online = typeof navigator !== 'undefined' && navigator.onLine
        const addr = online ? await reverse(pos.lat, pos.lng).catch(() => null) : null
        const captured_at = new Date().toISOString()
        const gps_start: JobCardGpsPayload = {
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          captured_at,
        }
        const body = {
          status: 'in_progress' as const,
          start_time: captured_at,
          gps_start,
          gps_start_address: addr?.display ?? null,
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          await enqueueJobPatch(jobId, body)
          onQueued?.()
          return { ok: true as const, offline: true }
        }

        const res = await fetch(`/api/job-cards/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || 'Start job failed')
        }
        return { ok: true as const, offline: false }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { startJob, loading }
}
