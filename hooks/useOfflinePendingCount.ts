import { useCallback, useEffect, useState } from 'react'
import { offlineCountPending } from '@/lib/offline-db'

export function useOfflinePendingCount(pollMs = 3000) {
  const [pendingCount, setPendingCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      setPendingCount(await offlineCountPending())
    } catch {
      setPendingCount(0)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), pollMs)
    const onFocus = () => void refresh()
    const onOnline = () => void refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [pollMs, refresh])

  return { pendingCount, refresh }
}

