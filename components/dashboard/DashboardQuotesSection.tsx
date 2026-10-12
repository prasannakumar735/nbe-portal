'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatCard } from '@/components/ui/StatCard'

export type QuotesDashboardData = {
  serviceCount: number
  serviceTotal: number
  pvcCount: number
  pvcTotal: number
  trends: { period: string; service_total: number; pvc_total: number }[]
}

const PIE_COLORS = ['#1d4ed8', '#059669']

function fmt(n: number) {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function shortDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}

export function DashboardQuotesSection({ data }: { data: QuotesDashboardData }) {
  const totalCount = data.serviceCount + data.pvcCount
  const totalRevenue = data.serviceTotal + data.pvcTotal

  const pieData = [
    { name: 'Service Quotes', value: data.serviceTotal },
    { name: 'PVC Estimates', value: data.pvcTotal },
  ].filter(d => d.value > 0)

  const barData = data.trends.map(t => ({
    period: shortDate(t.period),
    'Service': t.service_total,
    'PVC': t.pvc_total,
  }))

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Quotes & Revenue (last 30 days)</h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Quotes" value={String(totalCount)} helper="Service + PVC" />
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} helper="All quote types" />
        <StatCard label="Service Quotes" value={String(data.serviceCount)} helper={fmt(data.serviceTotal)} />
        <StatCard label="PVC Estimates" value={String(data.pvcCount)} helper={fmt(data.pvcTotal)} />
      </div>

      {totalRevenue === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
          No quote revenue in the last 30 days.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="hover:shadow-md">
            <SectionHeader title="Revenue by Type" subtitle="Service vs PVC split" />
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name}: ${Math.round((percent ?? 0) * 100)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown) => fmt(Number(v))}
                    contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="lg:col-span-2 hover:shadow-md">
            <SectionHeader title="Weekly Revenue Trend" subtitle="Service & PVC by week" />
            <div className="mt-4 h-64 w-full">
              {barData.length === 0 ? (
                <p className="text-sm text-gray-400">No trend data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" tickFormatter={v => `$${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      formatter={(v: unknown) => fmt(Number(v))}
                      contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Bar dataKey="Service" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="PVC" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      )}
    </section>
  )
}
