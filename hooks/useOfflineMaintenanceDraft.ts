import { useEffect, useState } from 'react'

type OfflineDraftPayload = {
  report_id?: string
  status: 'draft' | 'submitted' | 'reviewing'
  form: unknown
}

type UseOfflineMaintenanceDraftParams = {
  storageKey?: string
  onSynced?: () => void
}

export function useOfflineMaintenanceDraft(params?: UseOfflineMaintenanceDraftParams) {
  const storageKey = params?.storageKey || 'maintenance:pendingDraft'
  const [isOffline, setIsOffline] = useState(false)
  const [hasPendingDraft, setHasPendingDraft] = useState(false)

  const saveOfflineDraft = (payload: OfflineDraftPayload) => {
    localStorage.setItem(storageKey, JSON.stringify(payload))
    setHasPendingDraft(true)
  }

  const clearOfflineDraft = () => {
    localStorage.removeItem(storageKey)
    setHasPendingDraft(false)
  }

  const syncPendingDraft = async () => {
    const raw = localStorage.getItem(storageKey)
    if (!raw || !navigator.onLine) {
      setHasPendingDraft(Boolean(raw))
      return false
    }

    try {
      const response = await fetch('/api/maintenance/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      })

      if (!response.ok) {
        return false
      }

      clearOfflineDraft()
      params?.onSynced?.()
      return true
    } catch {
      return false
    }
  }

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    setHasPendingDraft(Boolean(localStorage.getItem(storageKey)))

    const onlineHandler = async () => {
      setIsOffline(false)
      await syncPendingDraft()
    }

    const offlineHandler = () => {
      setIsOffline(true)
    }

    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)

    void syncPendingDraft()

    return () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
    }
  }, [storageKey])

  return {
    isOffline,
    hasPendingDraft,
    saveOfflineDraft,
    clearOfflineDraft,
    syncPendingDraft,
  }
}
