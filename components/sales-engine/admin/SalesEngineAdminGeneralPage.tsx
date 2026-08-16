'use client'

import { useAuth } from '@/app/providers/AuthProvider'
import { SalesEngineAdminShell } from '@/components/sales-engine/admin/SalesEngineAdminShell'
import {
  SalesEngineSettingsEditor,
  filterDefinitions,
} from '@/components/sales-engine/admin/SalesEngineSettingsEditor'
import { SalesEngineAdminManualJobTriggersPanel } from '@/components/sales-engine/admin/SalesEngineAdminManualJobTriggersPanel'
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
    <>
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

      <div className="mt-6 w-full min-w-0 max-w-4xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Manual job triggers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Run sales engine jobs on demand without waiting for the daily cron.
          </p>
          <div className="mt-4">
            <SalesEngineAdminManualJobTriggersPanel />
          </div>
        </section>
      </div>
    </>
  )
}
