'use client'

import type { SalesBusinessSummary } from '@/lib/sales/types/business.types'

type DiscoverySummaryCardProps = {
  summary: SalesBusinessSummary | null
  loading: boolean
}

export function DiscoverySummaryCard({ summary, loading }: DiscoverySummaryCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total businesses found
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">
            {loading ? '—' : (summary?.total ?? 0)}
          </dd>
        </div>
        <div className="rounded-xl bg-indigo-50 px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-indigo-700">
            Selected businesses
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-indigo-900">
            {loading ? '—' : (summary?.selected ?? 0)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
