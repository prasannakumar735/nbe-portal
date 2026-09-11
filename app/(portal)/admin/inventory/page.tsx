'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ComponentRow, InventoryMovementRow } from '@/lib/types/inventory.types'

const SHEET_LABELS: Record<string, string> = {
  INVENTORY_RD: 'Rapid Door',
  INVENTORY_PVC: 'PVC Strip',
  INVENTORY_UF: 'Unfixed Hardware',
}

const MOVEMENT_COLORS: Record<string, string> = {
  in: 'bg-emerald-100 text-emerald-800',
  out: 'bg-red-100 text-red-800',
  adjustment: 'bg-blue-100 text-blue-800',
  reserved: 'bg-amber-100 text-amber-800',
  release: 'bg-slate-100 text-slate-700',
}

export default function InventoryDashboardPage() {
  const [components, setComponents] = useState<ComponentRow[]>([])
  const [alerts, setAlerts] = useState<ComponentRow[]>([])
  const [movements, setMovements] = useState<InventoryMovementRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadInventory() {
      try {
        const [componentsRes, alertsRes, movementsRes] = await Promise.all([
          fetch('/api/inventory/components', { cache: 'no-store' }),
          fetch('/api/inventory/alerts', { cache: 'no-store' }),
          fetch('/api/inventory/movements?limit=15', { cache: 'no-store' }),
        ])
        if (!componentsRes.ok) { setError('Failed to load inventory data.'); return }
        const [compData, alertData, movData] = await Promise.all([
          componentsRes.json(),
          alertsRes.ok ? alertsRes.json() : { alerts: [] },
          movementsRes.ok ? movementsRes.json() : { movements: [] },
        ])
        if (cancelled) return
        setComponents(compData.components ?? [])
        setAlerts(alertData.alerts ?? [])
        setMovements(movData.movements ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load inventory')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadInventory()
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => {
    const bySheet: Record<string, number> = {}
    const byCategory: Record<string, number> = {}
    let totalStock = 0
    for (const c of components) {
      totalStock += Number(c.stock_quantity ?? 0)
      const sheet = c.source_sheet ?? 'Other'
      bySheet[sheet] = (bySheet[sheet] ?? 0) + 1
      const cat = c.category ?? 'Uncategorised'
      byCategory[cat] = (byCategory[cat] ?? 0) + 1
    }
    return { totalStock, bySheet, byCategory }
  }, [components])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Loading inventory…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    )
  }

  const PREVIEW_LIMIT = 8

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Stock control across Rapid Door, PVC Strip &amp; Hardware components</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/inventory/components"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            All Components
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Total SKUs"
          value={components.length}
          icon={<BoxIcon />}
          color="indigo"
        />
        <KpiCard
          label="Low Stock"
          value={alerts.length}
          icon={<AlertIcon />}
          color={alerts.length > 0 ? 'amber' : 'emerald'}
          suffix={alerts.length > 0 ? 'items need reorder' : 'all stocked'}
        />
        <KpiCard
          label="Recent Movements"
          value={movements.length}
          icon={<MovementIcon />}
          color="slate"
        />
        <KpiCard
          label="Total Stock Qty"
          value={stats.totalStock.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          icon={<ChartIcon />}
          color="emerald"
        />
      </div>

      {/* Product line breakdown + Low stock side-by-side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Product Lines */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">By Product Line</h2>
          <div className="space-y-3">
            {Object.entries(stats.bySheet).map(([sheet, count]) => (
              <div key={sheet} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${sheetDot(sheet)}`} />
                  <span className="text-sm text-slate-700">{SHEET_LABELS[sheet] ?? sheet}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
            {Object.entries(SHEET_LABELS).map(([key, label]) => (
              <Link key={key} href={`/admin/inventory/components?sheet=${key}`}
                className="text-xs text-indigo-600 hover:underline">
                {label} →
              </Link>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Low Stock Alerts</h2>
            {alerts.length > PREVIEW_LIMIT && (
              <Link href="/admin/inventory/alerts" className="text-xs text-indigo-600 hover:underline">
                View all ({alerts.length}) →
              </Link>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-emerald-800">All components are adequately stocked</span>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, PREVIEW_LIMIT).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <div>
                    <span className="text-sm font-medium text-amber-900">{alert.name}</span>
                    <span className="ml-2 text-xs text-amber-600 font-mono">{alert.sku}</span>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-sm font-bold text-amber-800">{Number(alert.stock_quantity).toFixed(2)}</span>
                    <span className="text-xs text-amber-600"> / min {Number(alert.min_stock).toFixed(2)} {alert.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Movements */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Recent Stock Movements</h2>
          <span className="text-xs text-slate-400">Last 15 transactions</span>
        </div>
        {movements.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 text-center">No stock movements recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Component</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Qty</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-800 max-w-[200px] truncate">
                      {m.component?.name ?? m.component?.sku ?? '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${MOVEMENT_COLORS[m.movement_type] ?? 'bg-slate-100 text-slate-700'}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-900 text-right tabular-nums">
                      {Number(m.quantity).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {m.reference_type ?? '-'} {m.reference_id ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nav shortcuts */}
      <div className="flex flex-wrap gap-3 pt-1">
        {[
          { href: '/admin/inventory/components', label: 'Components', desc: 'Browse & adjust stock' },
          { href: '/admin/inventory/products', label: 'Products', desc: 'Finished goods' },
          { href: '/admin/inventory/bom', label: 'Bill of Materials', desc: 'Component mappings' },
          { href: '/admin/inventory/alerts', label: 'Alerts', desc: 'Reorder watchlist' },
          { href: '/admin/orders/create', label: 'Create Order', desc: 'Consume stock' },
        ].map((nav) => (
          <Link key={nav.href} href={nav.href}
            className="flex-1 min-w-[140px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:border-indigo-300 hover:shadow-sm transition-all group">
            <p className="font-semibold text-slate-800 group-hover:text-indigo-700">{nav.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{nav.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function sheetDot(sheet: string) {
  const map: Record<string, string> = {
    INVENTORY_RD: 'bg-indigo-500',
    INVENTORY_PVC: 'bg-teal-500',
    INVENTORY_UF: 'bg-amber-500',
  }
  return map[sheet] ?? 'bg-slate-400'
}

function KpiCard({ label, value, icon, color, suffix }: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: 'indigo' | 'amber' | 'emerald' | 'slate'
  suffix?: string
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  const valueColors = {
    indigo: 'text-slate-900',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    slate: 'text-slate-900',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <span className={`rounded-lg p-1.5 ${colors[color]}`}>{icon}</span>
      </div>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${valueColors[color]}`}>{value}</p>
      {suffix && <p className="mt-0.5 text-xs text-slate-500">{suffix}</p>}
    </div>
  )
}

function BoxIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}
function MovementIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}
