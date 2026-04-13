'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPendingQueueCounts, processFieldSyncQueue } from '@/lib/offline/fieldSyncDb'

export function useOfflineQueue() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const refreshPending = useCallback(async () => {
    const c = await getPendingQueueCounts().catch(() => ({ total: 0 }))
    setPending(c.total)
  }, [])

  const sync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setSyncing(true)
    setLastError(null)
    try {
      const r = await processFieldSyncQueue()
      if (r.errors.length) {
        setLastError(r.errors[0] ?? null)
      }
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
      await refreshPending()
    }
  }, [refreshPending])

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    void refreshPending()
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void sync()
    }

    const onOnline = () => {
      setOnline(true)
      void sync()
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refreshPending, sync])

  return { online, pending, syncing, lastError, sync, refreshPending }
}
