'use client'

import { useAuth } from '@/app/providers/AuthProvider'
import { SalesEngineAdminShell } from '@/components/sales-engine/admin/SalesEngineAdminShell'
import {
  SalesEngineSettingsEditor,
  filterDefinitions,
} from '@/components/sales-engine/admin/SalesEngineSettingsEditor'
import { useSalesEngineSettings } from '@/hooks/useSalesEngineSettings'

export function SalesEngineAdminFeatureFlagsPage() {
  const { isAdmin, isManager } = useAuth()
  const canRead = isAdmin || isManager
  const { loading, saving, error, data, savePatches } = useSalesEngineSettings(canRead)

  if (!canRead) {
    return (
      <SalesEngineAdminShell title="Feature flags">
        <p className="text-sm text-slate-600">Manager or admin access required.</p>
      </SalesEngineAdminShell>
    )
  }

  const definitions = filterDefinitions(data, ['feature_flags', 'safe_delivery'])

  return (
    <SalesEngineAdminShell
      title="Feature flags"
      description="Pilot Safe Delivery Mode redirects all outbound sends to a testing inbox while preserving the original recipient in delivery logs."
    >
      {loading ? <p className="text-sm text-slate-600">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {data?.snapshot.safeDeliveryEnabled ? (
        <div
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          <strong>Pilot mode active.</strong> Outbound mail is redirected to{' '}
          <span className="font-mono">{data.snapshot.safeDeliveryRedirectEmail || '(not set)'}</span>.
          Original customer addresses are stored on delivery logs only.
        </div>
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
