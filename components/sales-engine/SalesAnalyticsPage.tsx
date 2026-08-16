'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { SalesAnalyticsDashboard } from '@/lib/sales/types/salesAnalytics.types'

function formatPct(rate: number | null): string {
  if (rate == null) return '—'
  return `${Math.round(rate * 100)}%`
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function SalesAnalyticsPage() {
  const [dashboard, setDashboard] = useState<SalesAnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await salesEngineFetch<{ dashboard: SalesAnalyticsDashboard }>(
        '/api/sales/analytics/dashboard',
      )
      setDashboard(res.dashboard)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const d = dashboard

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/sales-engine"
            className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            ← Sales Engine
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Sales analytics</h1>
          <p className="mt-1 text-sm text-slate-600">
            Discovery, outreach, engagement, costs, and ROI (read-only aggregates).
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

      {loading && !d ? <p className="text-sm text-slate-600">Loading…</p> : null}

      {d ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Businesses discovered" value={String(d.funnel.businessesDiscovered)} />
            <StatCard label="Contacts discovered" value={String(d.funnel.contactsDiscovered)} />
            <StatCard label="Emails generated" value={String(d.funnel.emailsGenerated)} />
            <StatCard label="Approved (incl. queued)" value={String(d.funnel.emailsApproved)} />
            <StatCard label="Sent" value={String(d.funnel.emailsSent)} />
            <StatCard label="Open rate" value={formatPct(d.funnel.openRate)} />
            <StatCard label="Reply rate" value={formatPct(d.funnel.replyRate)} />
            <StatCard
              label="Campaign ROI"
              value={d.roi.roiRatio != null ? `${d.roi.roiRatio.toFixed(2)}×` : '—'}
              hint={`Won ${formatAud(d.roi.wonRevenueAud)} vs spend ${formatUsd(d.costs.totalSpendUsd)}`}
            />
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Costs</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">AI cost</dt>
                  <dd className="font-semibold text-slate-900">{formatUsd(d.costs.aiCostUsd)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Google API (est.)</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatUsd(d.costs.googleApiCostUsd)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-slate-100 pt-3">
                  <dt className="font-medium text-slate-800">Total spend</dt>
                  <dd className="font-bold text-slate-900">{formatUsd(d.costs.totalSpendUsd)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-slate-500">{d.costs.googleApiCostNote}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">ROI</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Won pipeline revenue</dt>
                  <dd className="font-semibold text-slate-900">{formatAud(d.roi.wonRevenueAud)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">ROI ratio</dt>
                  <dd className="font-semibold text-slate-900">
                    {d.roi.roiRatio != null ? `${d.roi.roiRatio.toFixed(2)}×` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">ROI %</dt>
                  <dd className="font-semibold text-slate-900">{formatPct(d.roi.roiPercent)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-slate-500">
                Won revenue from CRM pipeline (AUD). Spend uses AI + estimated Google Places USD.
              </p>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <RankList title="Top industries" rows={d.topIndustries} />
            <RankList title="Top suburbs" rows={d.topSuburbs} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
              <h2 className="text-lg font-semibold text-slate-900">Top campaigns</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Sent</th>
                    <th className="px-4 py-3">Replies</th>
                    <th className="px-4 py-3">AI cost</th>
                    <th className="px-4 py-3">Won rev.</th>
                    <th className="px-4 py-3">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.topCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        No campaign activity yet.
                      </td>
                    </tr>
                  ) : (
                    d.topCampaigns.map((c) => (
                      <tr key={c.campaignId}>
                        <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                        <td className="px-4 py-3">{c.emailsSent}</td>
                        <td className="px-4 py-3">{c.replies}</td>
                        <td className="px-4 py-3">{formatUsd(c.aiCostUsd)}</td>
                        <td className="px-4 py-3">{formatAud(c.wonRevenueAud)}</td>
                        <td className="px-4 py-3">
                          {c.roiRatio != null ? `${c.roiRatio.toFixed(2)}×` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
              <h2 className="text-lg font-semibold text-slate-900">Top prompts</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Prompt</th>
                    <th className="px-4 py-3">Delivered</th>
                    <th className="px-4 py-3">Opened</th>
                    <th className="px-4 py-3">Replied</th>
                    <th className="px-4 py-3">Open rate</th>
                    <th className="px-4 py-3">Reply rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.topPrompts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        No prompt engagement data yet.
                      </td>
                    </tr>
                  ) : (
                    d.topPrompts.map((p) => (
                      <tr key={`${p.promptName}-${p.promptVersion}`}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">{p.promptName}</span>
                          <span className="ml-1 text-xs text-slate-500">v{p.promptVersion}</span>
                        </td>
                        <td className="px-4 py-3">{p.delivered}</td>
                        <td className="px-4 py-3">{p.opened}</td>
                        <td className="px-4 py-3">{p.replied}</td>
                        <td className="px-4 py-3">{formatPct(p.openRate)}</td>
                        <td className="px-4 py-3">{formatPct(p.replyRate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-slate-500">
            Generated {new Date(d.generatedAt).toLocaleString('en-AU')}
          </p>
        </>
      ) : null}
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

function RankList({
  title,
  rows,
}: {
  title: string
  rows: { label: string; count: number }[]
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <ul className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <li className="text-sm text-slate-500">No data.</li>
        ) : (
          rows.map((row) => (
            <li key={row.label} className="flex justify-between text-sm">
              <span className="text-slate-800">{row.label}</span>
              <span className="font-semibold text-slate-900">{row.count}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
