'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import {
  SALES_PIPELINE_STAGE_LABELS,
  SALES_PIPELINE_STAGES,
  type SalesPipelineStage,
} from '@/lib/sales/constants/pipelineStages'
import type {
  SalesPipelineDashboard,
  SalesPipelineOpportunityListItem,
  SalesPipelineOwnerOption,
} from '@/lib/sales/types/pipeline.types'

function formatAud(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatPct(rate: number | null): string {
  if (rate == null) return '—'
  return `${Math.round(rate * 100)}%`
}

type LoadState = {
  dashboard: SalesPipelineDashboard | null
  opportunities: SalesPipelineOpportunityListItem[]
  owners: SalesPipelineOwnerOption[]
}

export function SalesPipelinePage() {
  const [state, setState] = useState<LoadState>({
    dashboard: null,
    opportunities: [],
    owners: [],
  })
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, listRes, ownersRes] = await Promise.all([
        salesEngineFetch<{ dashboard: SalesPipelineDashboard }>('/api/sales/pipeline/dashboard'),
        salesEngineFetch<{ opportunities: SalesPipelineOpportunityListItem[] }>(
          '/api/sales/pipeline/opportunities?limit=500',
        ),
        salesEngineFetch<{ owners: SalesPipelineOwnerOption[] }>('/api/sales/pipeline/owners'),
      ])
      setState({
        dashboard: dashRes.dashboard,
        opportunities: listRes.opportunities,
        owners: ownersRes.owners,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selected = useMemo(
    () => state.opportunities.find((o) => o.id === selectedId) ?? null,
    [state.opportunities, selectedId],
  )

  const ownerLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of state.owners) m.set(o.id, o.label)
    return m
  }, [state.owners])

  const patchOpportunity = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setSavingId(id)
      try {
        const res = await salesEngineFetch<{ opportunity: SalesPipelineOpportunityListItem }>(
          `/api/sales/pipeline/opportunities/${id}`,
          { method: 'PATCH', body: JSON.stringify(body) },
        )
        setState((prev) => ({
          ...prev,
          opportunities: prev.opportunities.map((o) =>
            o.id === id ? { ...o, ...res.opportunity } : o,
          ),
        }))
        await refresh()
        toast.success('Saved')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed')
      } finally {
        setSavingId(null)
      }
    },
    [refresh],
  )

  const dash = state.dashboard

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header>
        <Link
          href="/dashboard/sales-engine"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          ← Sales Engine
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">CRM pipeline</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track deals from lead through won/lost — revenue, probability, owner, follow-ups, and notes.
        </p>
      </header>

      {loading && !dash ? (
        <p className="text-sm text-slate-600">Loading pipeline…</p>
      ) : null}

      {dash ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Weighted forecast" value={formatAud(dash.forecast_cents)} />
            <MetricCard
              label="Open pipeline revenue"
              value={formatAud(dash.total_open_revenue_cents)}
            />
            <MetricCard
              label="Inspection value"
              value={formatAud(dash.inspection_value_cents)}
            />
            <MetricCard
              label="Win rate (closed)"
              value={formatPct(dash.conversion.win_rate)}
              hint={`${dash.conversion.won} won · ${dash.conversion.lost} lost · ${dash.follow_up_due_count} follow-ups due`}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Pipeline by stage</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-7">
              {dash.pipeline.map((bucket) => (
                <div
                  key={bucket.stage}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-center"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {SALES_PIPELINE_STAGE_LABELS[bucket.stage]}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{bucket.count}</p>
                  <p className="mt-1 text-xs text-slate-600">{formatAud(bucket.revenue_cents)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Conversion snapshot</h2>
            <p className="mt-1 text-sm text-slate-600">
              Share of opportunities at or beyond each stage (current position).
            </p>
            <ul className="mt-4 space-y-2">
              {dash.conversion.stage_funnel.map((row) => (
                <li key={row.stage} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">
                    {SALES_PIPELINE_STAGE_LABELS[row.stage]}
                  </span>
                  <span className="text-slate-600">
                    {row.reached_count} · {formatPct(row.rate_from_lead)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Opportunities</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Prob.</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Follow-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.opportunities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No opportunities yet. Create one via API with a business id, or add a UI hook
                    from discovery later.
                  </td>
                </tr>
              ) : (
                state.opportunities.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer hover:bg-slate-50 ${selectedId === row.id ? 'bg-indigo-50/50' : ''}`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.title}</p>
                      <p className="text-xs text-slate-500">
                        {row.business?.company_name ?? row.business_id}
                        {row.business?.postcode ? ` · ${row.business.postcode}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {SALES_PIPELINE_STAGE_LABELS[row.stage]}
                    </td>
                    <td className="px-4 py-3">{formatAud(row.revenue_cents)}</td>
                    <td className="px-4 py-3">{row.probability_percent}%</td>
                    <td className="px-4 py-3">
                      {row.owner_user_id
                        ? ownerLabelById.get(row.owner_user_id) ?? row.owner_user_id.slice(0, 8)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.next_follow_up_at
                        ? new Date(row.next_follow_up_at).toLocaleDateString('en-AU')
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <OpportunityEditor
          opportunity={selected}
          owners={state.owners}
          saving={savingId === selected.id}
          onSave={(body) => void patchOpportunity(selected.id, body)}
        />
      ) : null}
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

function OpportunityEditor({
  opportunity,
  owners,
  saving,
  onSave,
}: {
  opportunity: SalesPipelineOpportunityListItem
  owners: SalesPipelineOwnerOption[]
  saving: boolean
  onSave: (body: Record<string, unknown>) => void
}) {
  const [stage, setStage] = useState(opportunity.stage)
  const [revenueAud, setRevenueAud] = useState(String(opportunity.revenue_cents / 100))
  const [inspectionAud, setInspectionAud] = useState(
    String(opportunity.inspection_value_cents / 100),
  )
  const [probability, setProbability] = useState(String(opportunity.probability_percent))
  const [ownerUserId, setOwnerUserId] = useState(opportunity.owner_user_id ?? '')
  const [followUp, setFollowUp] = useState(
    opportunity.next_follow_up_at ? opportunity.next_follow_up_at.slice(0, 16) : '',
  )
  const [notes, setNotes] = useState(opportunity.notes)

  useEffect(() => {
    setStage(opportunity.stage)
    setRevenueAud(String(opportunity.revenue_cents / 100))
    setInspectionAud(String(opportunity.inspection_value_cents / 100))
    setProbability(String(opportunity.probability_percent))
    setOwnerUserId(opportunity.owner_user_id ?? '')
    setFollowUp(opportunity.next_follow_up_at ? opportunity.next_follow_up_at.slice(0, 16) : '')
    setNotes(opportunity.notes)
  }, [opportunity])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Edit opportunity</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Stage</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={stage}
            onChange={(e) => setStage(e.target.value as SalesPipelineStage)}
          >
            {SALES_PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {SALES_PIPELINE_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Owner</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Revenue (AUD)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={revenueAud}
            onChange={(e) => setRevenueAud(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Inspection value (AUD)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={inspectionAud}
            onChange={(e) => setInspectionAud(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Probability %</span>
          <input
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Next follow-up</span>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Notes</span>
          <textarea
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={saving}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        onClick={() =>
          onSave({
            stage,
            revenueCents: Math.round(Number(revenueAud || 0) * 100),
            inspectionValueCents: Math.round(Number(inspectionAud || 0) * 100),
            probabilityPercent: Number(probability),
            ownerUserId: ownerUserId || null,
            nextFollowUpAt: followUp ? new Date(followUp).toISOString() : null,
            notes,
          })
        }
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </section>
  )
}
