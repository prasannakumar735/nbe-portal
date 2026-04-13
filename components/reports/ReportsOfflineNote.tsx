'use client'

import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'

/**
 * Lightweight hint that operational reports reflect server data; offline drafts may still be syncing (timecard IDB).
 */
export function ReportsOfflineNote() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) {
    return (
      <p className="text-xs text-slate-500">
        Figures reflect saved server records. If technicians worked offline, timecards sync when they reconnect.
      </p>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>You are offline. Reconnect to refresh report data from the server.</p>
    </div>
  )
}
