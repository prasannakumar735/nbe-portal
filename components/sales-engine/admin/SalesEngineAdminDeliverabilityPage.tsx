'use client'

import { useAuth } from '@/app/providers/AuthProvider'
import { SalesEngineAdminShell } from '@/components/sales-engine/admin/SalesEngineAdminShell'
import {
  SalesEngineSettingsEditor,
  filterDefinitions,
} from '@/components/sales-engine/admin/SalesEngineSettingsEditor'
import { useSalesEngineSettings } from '@/hooks/useSalesEngineSettings'

export function SalesEngineAdminDeliverabilityPage() {
  const { isAdmin, isManager } = useAuth()
  const canRead = isAdmin || isManager
  const { loading, saving, error, data, savePatches } = useSalesEngineSettings(canRead)

  if (!canRead) {
    return (
      <SalesEngineAdminShell title="Email deliverability">
        <p className="text-sm text-slate-600">Manager or admin access required.</p>
      </SalesEngineAdminShell>
    )
  }

  const definitions = filterDefinitions(data, ['deliverability'])

  return (
    <SalesEngineAdminShell
      title="Email deliverability"
      description="Configuration foundation for send limits and authentication status. Third-party monitoring is not integrated yet."
    >
      <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <p>
          <strong>Outlook Focused Inbox:</strong> Microsoft Graph cannot force Focused vs Other.
          Placement is decided per mailbox by Outlook intelligence. Do not rely on custom headers to
          control Focused Inbox.
        </p>
        <p>
          <strong>Inbox placement (NBE):</strong> Align SPF, DKIM, and DMARC on your sending domain;
          keep volume low during pilot; use Safe Delivery Mode; follow the AI Writing Manual for
          content; warm up gradually; maintain list hygiene via existing bounce handling.
        </p>
      </div>

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
