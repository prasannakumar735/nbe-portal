'use client'

import { SalesEngineToolsNav } from '@/components/sales-engine/SalesEngineToolsNav'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import { SALES_AGENT_LABELS, type SalesCoreAgentId } from '@/lib/sales/agents/agent.types'
import type { SalesAgentDefinition } from '@/lib/sales/agents/runtime/agentRuntime.types'
import type { SalesAgentRun } from '@/lib/sales/repositories/salesAgentRunRepository'

type AgentsPayload = {
  agents: SalesAgentDefinition[]
  status: { agentId: SalesCoreAgentId; queueKind: string; pendingCount: number | null }[]
  recentRuns: SalesAgentRun[]
}

export function SalesAgentsPage() {
  const [data, setData] = useState<AgentsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await salesEngineFetch<AgentsPayload>('/api/sales/agents?runsLimit=15')
      setData(res)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dispatch = useCallback(
    async (agentId: SalesCoreAgentId) => {
      setDispatching(agentId)
      try {
        await salesEngineFetch('/api/sales/agents', {
          method: 'POST',
          body: JSON.stringify({ agentId, limit: 5 }),
        })
        toast.success(`${SALES_AGENT_LABELS[agentId]} dispatched`)
        await load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Dispatch failed')
      } finally {
        setDispatching(null)
      }
    },
    [load],
  )

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales agents</h1>
          <p className="mt-1 text-sm text-slate-600">
            Queue-backed autonomous agents — retryable, observable, independent dispatch.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </header>
      <SalesEngineToolsNav />

      {loading && !data ? <p className="text-sm text-slate-600">Loading…</p> : null}

      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.agents.map((agent) => {
              const snap = data.status.find((s) => s.agentId === agent.id)
              return (
                <div
                  key={agent.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col"
                >
                  <h2 className="text-sm font-semibold text-slate-900">{agent.label}</h2>
                  <p className="mt-1 text-xs text-slate-500">{agent.queueKind}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {snap?.pendingCount ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500">pending</p>
                  <button
                    type="button"
                    disabled={dispatching === agent.id}
                    onClick={() => void dispatch(agent.id)}
                    className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {dispatching === agent.id ? 'Running…' : 'Dispatch (5)'}
                  </button>
                </div>
              )
            })}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-slate-900">Recent agent runs</h2>
            </div>
            <ul className="divide-y divide-slate-100 text-sm">
              {data.recentRuns.length === 0 ? (
                <li className="px-4 py-6 text-slate-500">No runs recorded yet.</li>
              ) : (
                data.recentRuns.map((run) => (
                  <li key={run.id} className="px-4 py-3 flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-slate-800">{run.agent_id}</span>
                    <span className="text-slate-600">{run.status}</span>
                    <span className="text-xs text-slate-500">
                      {run.duration_ms}ms · {new Date(run.started_at).toLocaleString('en-AU')}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}
