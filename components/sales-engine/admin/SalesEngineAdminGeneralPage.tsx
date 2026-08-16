'use client'

import { useAuth } from '@/app/providers/AuthProvider'
import { SalesEngineAdminShell } from '@/components/sales-engine/admin/SalesEngineAdminShell'
import {
  SalesEngineSettingsEditor,
  filterDefinitions,
} from '@/components/sales-engine/admin/SalesEngineSettingsEditor'
import { useSalesEngineSettings } from '@/hooks/useSalesEngineSettings'

export function SalesEngineAdminGeneralPage() {
  const { isAdmin, isManager } = useAuth()
  const canRead = isAdmin || isManager
  const { loading, saving, error, data, savePatches } = useSalesEngineSettings(canRead)

  if (!canRead) {
    return (
      <SalesEngineAdminShell title="General">
        <p className="text-sm text-slate-600">Manager or admin access required.</p>
      </SalesEngineAdminShell>
    )
  }

  const definitions = filterDefinitions(data, ['general'])

  return (
    <SalesEngineAdminShell
      title="General settings"
      description="Master switches for Sales Engine availability."
    >
      {loading ? <p className="text-sm text-slate-600">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {data ? (
        <SalesEngineSettingsEditor
          definitions={definitions}
          values={data.values}
          saving={saving}
          readOnly={!isAdmin}
          onSave={savePatches}
        />
      ) : null}
    </SalesEngineAdminShell>
  )
}
