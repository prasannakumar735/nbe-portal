import type { ReportsSummary } from '@/lib/reports/types'
import { TrendingDown, TrendingUp } from 'lucide-react'

const card =
  'min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04]'

function TrendHint({ up }: { up: boolean | null }) {
  if (up === null) return null
  return up ? (
    <TrendingUp className="size-4 text-emerald-600" aria-hidden />
  ) : (
    <TrendingDown className="size-4 text-amber-600" aria-hidden />
  )
}

export function ReportsSummaryCards({ summary }: { summary: ReportsSummary | null }) {
  if (!summary) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={`${card} animate-pulse p-6`}>
              <div className="h-3 w-28 rounded bg-slate-200" />
              <div className="mt-4 h-10 w-36 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${card} animate-pulse`}>
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-3 h-8 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const billableTrend: boolean | null =
    summary.totalHours <= 0 ? null : summary.billablePercent >= 60 ? true : summary.billablePercent <= 35 ? false : null

  const primary = [
    {
      label: 'Total hours',
      value: summary.totalHours.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      hint: 'All timesheet entries',
      trend: null as boolean | null,
      large: true,
    },
    {
      label: 'Revenue',
      value: `$${summary.revenueTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      hint: 'Service + PVC in range',
      trend: null as boolean | null,
      large: true,
    },
  ]

  const secondary = [
    {
      label: 'Billable hours',
      value: summary.billableHours.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      hint: 'Billable lines',
      trend: null as boolean | null,
    },
    {
      label: 'Billable %',
      value: `${summary.billablePercent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
      hint: 'Of total hours',
      trend: billableTrend,
    },
    {
      label: 'Jobs completed',
      value: String(summary.jobsCompleted),
      hint: 'Maintenance approved / completed',
      trend: null as boolean | null,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {primary.map(item => (
          <div key={item.label} className={`${card} p-6`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <TrendHint up={item.trend} />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-4xl">{item.value}</p>
            <p className="mt-2 text-xs text-slate-500">{item.hint}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {secondary.map(item => (
          <div key={item.label} className={card}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
              <TrendHint up={item.trend} />
            </div>
            <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-900">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
