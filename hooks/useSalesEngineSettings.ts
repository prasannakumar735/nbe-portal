'use client'

import { useCallback, useEffect, useState } from 'react'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { SalesEngineAdminSettingsResponse } from '@/lib/sales/settings/salesEngineAdminSettingsService'

type UseSalesEngineSettingsResult = {
  loading: boolean
  saving: boolean
  error: string | null
  data: SalesEngineAdminSettingsResponse | null
  refresh: () => Promise<void>
  savePatches: (patches: { key: string; value: unknown }[]) => Promise<void>
}

export function useSalesEngineSettings(canRead: boolean): UseSalesEngineSettingsResult {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SalesEngineAdminSettingsResponse | null>(null)

  const refresh = useCallback(async () => {
    if (!canRead) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = await salesEngineFetch<SalesEngineAdminSettingsResponse>(
        '/api/sales/admin/settings',
      )
      setData(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [canRead])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const savePatches = useCallback(async (patches: { key: string; value: unknown }[]) => {
    setSaving(true)
    setError(null)
    try {
      const payload = await salesEngineFetch<SalesEngineAdminSettingsResponse>(
        '/api/sales/admin/settings',
        {
          method: 'PATCH',
          body: JSON.stringify({ settings: patches }),
        },
      )
      setData(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings')
      throw e
    } finally {
      setSaving(false)
    }
  }, [])

  return { loading, saving, error, data, refresh, savePatches }
}
