'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { EmailSendQueueMonitorSnapshot } from '@/lib/sales/sending/emailSendMonitorService'

type MonitorResponse = { snapshot: EmailSendQueueMonitorSnapshot }
type DispatchResponse = {
  summary: { sent: number; failed: number; retry: number; skipped: number }
  recoveredStuck: number
}

type EmailSendQueueMonitorPanelProps = {
  campaignId: string
  onMutated?: () => void | Promise<void>
}

export function EmailSendQueueMonitorPanel({ campaignId, onMutated }: EmailSendQueueMonitorPanelProps) {
  const [snapshot, setSnapshot] = useState<EmailSendQueueMonitorSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState(false)
  const [busyQueueId, setBusyQueueId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await salesEngineFetch<MonitorResponse>(
      `/api/sales/email-send-queue/monitor?campaignId=${encodeURIComponent(campaignId)}`,
    )
    setSnapshot(res.snapshot)
  }, [campaignId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        await refresh()
      } catch {
        if (!cancelled) setSnapshot(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    if (!snapshot || snapshot.pendingSend === 0) return
    const id = setInterval(() => {
      void refresh().catch(() => {})
    }, 3000)
    return () => clearInterval(id)
  }, [snapshot?.pendingSend, refresh])

  const dispatchNow = useCallback(async () => {
    setDispatching(true)
    try {
      const res = await salesEngineFetch<DispatchResponse>('/api/sales/email-send-queue/dispatch', {
        method: 'POST',
        body: JSON.stringify({ campaignId, limit: 20 }),
      })
      toast.success(
        `Dispatch: ${res.summary.sent} sent, ${res.summary.retry} retry, ${res.summary.failed} failed`,
      )
      await refresh()
      if (onMutated) await onMutated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dispatch failed')
    } finally {
      setDispatching(false)
    }
  }, [campaignId, onMutated, refresh])

  const resend = useCallback(
    async (queueId: string) => {
      setBusyQueueId(queueId)
      try {
        await salesEngineFetch(`/api/sales/email-send-queue/${queueId}/resend`, { method: 'POST' })
        toast.success('Re-queued for send')
        await refresh()
        if (onMutated) await onMutated()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Resend failed')
      } finally {
        setBusyQueueId(null)
      }
    },
    [onMutated, refresh],
  )

  if (loading && !snapshot) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading send queue…</p>
      </section>
    )
  }

  if (!snapshot) return null

  const { counts } = snapshot
  const failedItems = snapshot.activeItems.filter((i) => i.status === 'failed')

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Send queue (Microsoft 365)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Approved emails only. Dispatch sends via Microsoft Graph with rate limiting and retries.
          </p>
        </div>
        <button
          type="button"
          disabled={dispatching || counts.queued === 0}
          onClick={() => void dispatchNow()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {dispatching ? 'Sending…' : 'Dispatch queued'}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <dt className="text-xs text-slate-500">Queued</dt>
          <dd className="text-lg font-semibold text-indigo-700">{counts.queued}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Sending</dt>
          <dd className="text-lg font-semibold text-slate-900">{counts.sending}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Sent</dt>
          <dd className="text-lg font-semibold text-emerald-700">{counts.sent}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Failed</dt>
          <dd className="text-lg font-semibold text-red-700">{counts.failed}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Bounced</dt>
          <dd className="text-lg font-semibold text-amber-700">{counts.bounced}</dd>
        </div>
      </dl>

      {failedItems.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-slate-800">Failed items</h3>
          <ul className="mt-2 space-y-2">
            {failedItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-slate-600">{item.id.slice(0, 8)}…</span>
                <span className="text-slate-500">Attempts: {item.attempts}</span>
                <button
                  type="button"
                  disabled={busyQueueId === item.id}
                  onClick={() => void resend(item.id)}
                  className="text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
                >
                  Resend
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {snapshot.recentFailures.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-slate-800">Recent delivery errors</h3>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
            {snapshot.recentFailures.slice(0, 5).map((log) => (
              <li key={log.id} className="border-b border-slate-100 py-1">
                <span className="font-medium text-red-700">{log.status}</span>
                {log.failure_reason ? ` — ${log.failure_reason.slice(0, 120)}` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
