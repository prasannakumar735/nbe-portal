'use client'

import { useAuth } from '@/app/providers/AuthProvider'
import { useSalesEngineSettings } from '@/hooks/useSalesEngineSettings'

export function SalesEnginePilotModeBanner() {
  const { isAdmin, isManager } = useAuth()
  const canRead = isAdmin || isManager
  const { data } = useSalesEngineSettings(canRead)

  if (!canRead || !data?.snapshot.safeDeliveryEnabled) return null

  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <strong>Safe Delivery Mode (pilot)</strong> — approved emails send to{' '}
      <span className="font-mono">{data.snapshot.safeDeliveryRedirectEmail}</span>, not the customer.
      Original recipients are recorded on delivery logs. Disable in{' '}
      {isAdmin ? (
        <a
          href="/dashboard/sales-engine/administration/feature-flags"
          className="font-medium text-amber-900 underline"
        >
          Administration → Feature flags
        </a>
      ) : (
        'Administration (admin only)'
      )}
      .
    </div>
  )
}
