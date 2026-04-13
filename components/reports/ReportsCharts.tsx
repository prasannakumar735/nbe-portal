'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReportsSummary } from '@/lib/reports/types'

const card =
  'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] min-w-0'

const COL_BILL = '#4f46e5'
const COL_NON = '#cbd5e1'
const COL_REV = '#059669'
const COL_HOURS = '#6366f1'

const EMPTY = 'No data available for selected period'

export function ReportsCharts({ summary }: { summary: ReportsSummary | null }) {
  const pieData = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Billable', value: summary.billableHours },
      { name: 'Non-billable', value: summary.nonBillableHours },
    ].filter(d => d.value > 0)
  }, [summary])

  const techData = useMemo(() => {
    if (!summary?.hoursByTechnician?.length) return []
    return summary.hoursByTechnician.map(t => ({
      name: t.name.length > 20 ? `${t.name.slice(0, 18)}…` : t.name,
      fullName: t.name,
      hours: t.hours,
    }))
  }, [summary])

  const revenueChartData = useMemo(() => {
    if (!summary?.revenueByDay?.length) return []
    return summary.revenueByDay.map(d => ({ date: d.date, revenue: d.amount }))
  }, [summary])

  if (!summary) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${card} animate-pulse`}>
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="mt-4 h-52 rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    )
  }

  const hasHoursSeries = summary.hoursByDay.length > 0
  const hasRevSeries = revenueChartData.length > 0
  const hasTech = techData.length > 0
  const hasPie = pieData.length > 0

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={card}>
        <h3 className="text-sm font-semibold text-slate-900">Billable vs non-billable</h3>
        <p className="mt-0.5 text-xs text-slate-500">Share of hours in the selected range</p>
        <div className="mt-3 h-56 w-full min-w-0 sm:h-64">
          {hasPie ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={entry.name === 'Billable' ? COL_BILL : COL_NON} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number | undefined) => [`${Number(v ?? 0).toLocaleString()} h`, 'Hours']}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full min-h-[12rem] items-center justify-center text-center text-sm text-slate-500">{EMPTY}</p>
          )}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-slate-900">Hours over time</h3>
        <p className="mt-0.5 text-xs text-slate-500">Total hours logged per day</p>
        <div className="mt-3 h-56 w-full min-w-0 sm:h-64">
          {hasHoursSeries ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.hoursByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} stroke="#64748b" width={36} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                  formatter={(v: number | undefined) => [`${Number(v ?? 0)} h`, 'Hours']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="hours" name="Hours" fill={COL_HOURS} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full min-h-[12rem] items-center justify-center text-center text-sm text-slate-500">{EMPTY}</p>
          )}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-slate-900">Revenue trend</h3>
        <p className="mt-0.5 text-xs text-slate-500">Service quotes + PVC estimates by day</p>
        <div className="mt-3 h-56 w-full min-w-0 sm:h-64">
          {hasRevSeries ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="#64748b"
                  width={48}
                  tickFormatter={v => `$${Number(v).toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                  formatter={(v: number | undefined) => [`$${Number(v ?? 0).toLocaleString()}`, 'Revenue']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke={COL_REV}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full min-h-[12rem] items-center justify-center text-center text-sm text-slate-500">{EMPTY}</p>
          )}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-slate-900">Technician performance</h3>
        <p className="mt-0.5 text-xs text-slate-500">Total hours by technician (filtered range)</p>
        <div className="mt-3 h-56 w-full min-w-0 sm:h-64">
          {hasTech ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={techData} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#64748b" />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 9 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                  formatter={(v: number | undefined, _n, p) => {
                    const full = (p?.payload as { fullName?: string })?.fullName
                    return [`${Number(v ?? 0)} h`, full ?? 'Technician']
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="hours" name="Hours" fill={COL_BILL} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full min-h-[12rem] items-center justify-center text-center text-sm text-slate-500">{EMPTY}</p>
          )}
        </div>
      </div>
    </div>
  )
}
