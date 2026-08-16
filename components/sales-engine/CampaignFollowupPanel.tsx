'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { SalesFollowupQueue } from '@/lib/sales/types/followupQueue.types'
import type { SalesFollowupSequence } from '@/lib/sales/types/followupSequence.types'

type CampaignFollowupPanelProps = {
  campaignId: string
  onMutated?: () => void | Promise<void>
}

export function CampaignFollowupPanel({ campaignId, onMutated }: CampaignFollowupPanelProps) {
  const [sequence, setSequence] = useState<SalesFollowupSequence | null>(null)
  const [queue, setQueue] = useState<SalesFollowupQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [enabled, setEnabled] = useState(true)
  const [delayDays, setDelayDays] = useState(3)
  const [maxFollowups, setMaxFollowups] = useState(3)

  const refresh = useCallback(async () => {
    const [seqRes, queueRes] = await Promise.all([
      salesEngineFetch<{ sequence: SalesFollowupSequence | null }>(
        `/api/sales/campaigns/${campaignId}/followup-sequence`,
      ),
      salesEngineFetch<{ items: SalesFollowupQueue[] }>(
        `/api/sales/campaigns/${campaignId}/followup-queue?limit=50`,
      ),
    ])
    setSequence(seqRes.sequence)
    setQueue(queueRes.items)
    if (seqRes.sequence) {
      setEnabled(seqRes.sequence.enabled)
      setDelayDays(seqRes.sequence.followup_delay_days)
      setMaxFollowups(seqRes.sequence.max_followups)
    }
  }, [campaignId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        await refresh()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const saveSequence = useCallback(async () => {
    setSaving(true)
    try {
      await salesEngineFetch(`/api/sales/campaigns/${campaignId}/followup-sequence`, {
        method: 'PUT',
        body: JSON.stringify({
          campaignId,
          enabled,
          maxFollowups,
          followupDelayDays: delayDays,
          stopOnReply: true,
        }),
      })
      toast.success('Follow-up settings saved')
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [campaignId, delayDays, enabled, maxFollowups, refresh])

  const generateDue = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await salesEngineFetch<{
        summary: { awaiting: number; skipped: number; failed: number }
      }>('/api/sales/followup-queue/dispatch', {
        method: 'POST',
        body: JSON.stringify({ limit: 15 }),
      })
      toast.success(`Generated ${res.summary.awaiting} follow-up draft(s) for review`)
      await refresh()
      if (onMutated) await onMutated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [onMutated, refresh])

  const dueCount = queue.filter((q) => q.status === 'scheduled').length
  const reviewCount = queue.filter((q) => q.status === 'awaiting_review').length

  if (loading && !sequence) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading follow-up settings…</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">AI follow-up</h2>
      <p className="mt-1 text-sm text-slate-600">
        After no reply, wait, then generate a follow-up draft. Manager must approve and queue send —
        never automatic.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <label className="text-sm text-slate-700">
          Wait (days)
          <input
            type="number"
            min={1}
            max={90}
            value={delayDays}
            onChange={(e) => setDelayDays(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm text-slate-700">
          Max follow-ups
          <input
            type="number"
            min={0}
            max={3}
            value={maxFollowups}
            onChange={(e) => setMaxFollowups(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveSequence()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        <button
          type="button"
          disabled={generating || !enabled}
          onClick={() => void generateDue()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate due follow-ups'}
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Scheduled: {dueCount} · Awaiting review: {reviewCount}
      </p>
    </section>
  )
}
