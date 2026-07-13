'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { CampaignEngagementFunnel } from '@/lib/sales/types/engagementEvent.types'

type EngagementResponse = {
  funnel: CampaignEngagementFunnel
  sync?: { deliveredRecorded: number; bouncedRecorded: number; skipped: number }
  metricsSnapshotsWritten?: number
}

type CampaignEngagementPanelProps = {
  campaignId: string
  funnel: CampaignEngagementFunnel | null
  onSynced?: () => void | Promise<void>
}

export function CampaignEngagementPanel({
  campaignId,
  funnel,
  onSynced,
}: CampaignEngagementPanelProps) {
  const [local, setLocal] = useState<CampaignEngagementFunnel | null>(funnel)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setLocal(funnel)
  }, [funnel])

  const syncFromDeliveryLogs = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await salesEngineFetch<EngagementResponse>(
        `/api/sales/campaigns/${campaignId}/engagement`,
        { method: 'POST' },
      )
      setLocal(res.funnel)
      toast.success(
        `Synced: ${res.sync?.deliveredRecorded ?? 0} delivered, ${res.sync?.bouncedRecorded ?? 0} bounced`,
      )
      if (onSynced) await onSynced()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [campaignId, onSynced])

  if (!local) return null

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Engagement tracking</h2>
          <p className="mt-1 text-sm text-slate-600">
            Delivered, opens, clicks, replies, bounces, and unsubscribes (event log + contact summary).
          </p>
        </div>
        <button
          type="button"
          disabled={syncing}
          onClick={() => void syncFromDeliveryLogs()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync from delivery logs'}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ['Delivered', local.delivered, local.contactsDelivered],
            ['Opened', local.opened, local.contactsOpened],
            ['Clicked', local.clicked, local.contactsClicked],
            ['Replied', local.replied, local.contactsReplied],
            ['Bounced', local.bounced, local.contactsBounced],
            ['Unsubscribed', local.unsubscribed, local.contactsUnsubscribed],
          ] as const
        ).map(([label, events, contacts]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-lg font-semibold text-slate-900">{events}</dd>
            <dd className="text-xs text-slate-500">{contacts} contacts</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
