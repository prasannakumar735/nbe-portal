'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ComponentRow, InventoryMovementRow } from '@/lib/types/inventory.types'

const SHEET_META: Record<string, { label: string; color: string }> = {
  INVENTORY_RD:  { label: 'Rapid Door',        color: '#2563EB' },
  INVENTORY_PVC: { label: 'PVC Strip',          color: '#0891B2' },
  INVENTORY_UF:  { label: 'Unfixed Hardware',   color: '#7C3AED' },
}

const MOVEMENT_CHIP: Record<string, string> = {
  in:         'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  out:        'bg-red-50 text-red-700 ring-1 ring-red-200',
  adjustment: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  reserved:   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  release:    'bg-slate-100 text-slate-600',
}

export default function InventoryDashboardPage() {
  const [components, setComponents] = useState<ComponentRow[]>([])
  const [alerts, setAlerts] = useState<ComponentRow[]>([])
  const [movements, setMovements] = useState<InventoryMovementRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [cRes, aRes, mRes] = await Promise.all([
          fetch('/api/inventory/components', { cache: 'no-store' }),
          fetch('/api/inventory/alerts', { cache: 'no-store' }),
          fetch('/api/inventory/movements?limit=12', { cache: 'no-store' }),
        ])
        if (!cRes.ok) { setError('Failed to load inventory.'); return }
        const [c, a, m] = await Promise.all([
          cRes.json(),
          aRes.ok ? aRes.json() : { alerts: [] },
          mRes.ok ? mRes.json() : { movements: [] },
        ])
        if (cancelled) return
        setComponents(c.components ?? [])
        setAlerts(a.alerts ?? [])
        setMovements(m.movements ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => {
    const bySheet: Record<string, number> = {}
    let totalStock = 0
    for (const c of components) {
      totalStock += Number(c.stock_quantity ?? 0)
      const sheet = c.source_sheet ?? 'Other'
      bySheet[sheet] = (bySheet[sheet] ?? 0) + 1
    }
    const total = components.length || 1
    return { totalStock, bySheet, total }
  }, [components])

  const sortedAlerts = useMemo(
    () => [...alerts].sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity)).slice(0, 10),
    [alerts],
  )

  if (isLoading) return (
    <div className="flex h-60 items-center justify-center gap-3 text-sm" style={{ color: '#64748B' }}>
      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Loading inventory…
    </div>
  )

  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
  )

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#2563EB', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em' }}>
            Stock Control
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight" style={{ color: '#0D1526', fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Inventory
          </h1>
        </div>
        <Link
          href="/admin/inventory/components"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#2563EB', fontFamily: "'IBM Plex Sans', sans-serif" }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
          Components
        </Link>
      </div>

      {/* Metrics rail — single surface, dividers between stats */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDE3F0', background: '#fff' }}>
        <div className="grid grid-cols-2 divide-x md:grid-cols-4">
          {[
            { label: 'Total SKUs',       value: components.length.toLocaleString(),                                 sub: '3 product lines',          accent: '#0D1526' },
            { label: 'Low Stock',        value: alerts.length.toLocaleString(),                                      sub: alerts.length > 0 ? 'need reorder' : 'all adequate', accent: alerts.length > 0 ? '#B45309' : '#16A34A' },
            { label: 'Stock Movements',  value: movements.length.toLocaleString(),                                   sub: 'last 12 recorded',         accent: '#0D1526' },
            { label: 'Total Stock Qty',  value: stats.totalStock.toLocaleString(undefined, { maximumFractionDigits: 0 }), sub: 'across all components', accent: '#2563EB' },
          ].map((m, i) => (
            <div key={i} className="px-6 py-5" style={{ borderRight: i < 3 ? '1px solid #DDE3F0' : undefined }}>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B', fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: '0.08em' }}>
                {m.label}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums" style={{ color: m.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
                {m.value}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: '#94A3B8', fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: category breakdown + low stock */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">

        {/* Category distribution — visual stacked bar */}
        <div className="md:col-span-2 rounded-xl border p-6 space-y-5" style={{ borderColor: '#DDE3F0', background: '#fff' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748B', fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: '0.1em' }}>
            By Product Line
          </h2>

          {/* Stacked bar */}
          <div className="h-2 rounded-full overflow-hidden flex" style={{ background: '#EEF2FF' }}>
            {Object.entries(stats.bySheet).map(([sheet, count]) => {
              const meta = SHEET_META[sheet] ?? { color: '#94A3B8' }
              const pct = (count / stats.total) * 100
              return (
                <div
                  key={sheet}
                  style={{ width: `${pct}%`, background: meta.color }}
                  title={`${meta.label ?? sheet}: ${count}`}
                />
              )
            })}
          </div>

          {/* Legend rows */}
          <div className="space-y-3">
            {Object.entries(stats.bySheet).map(([sheet, count]) => {
              const meta = SHEET_META[sheet] ?? { label: sheet, color: '#94A3B8' }
              const pct = Math.round((count / stats.total) * 100)
              return (
                <div key={sheet} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: meta.color }} />
                    <span className="text-sm" style={{ color: '#334155', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tabular-nums" style={{ color: '#94A3B8', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {pct}%
                    </span>
                    <span className="text-sm font-semibold tabular-nums w-10 text-right" style={{ color: '#0D1526', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {count}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick nav */}
          <div className="pt-2 border-t flex flex-wrap gap-3" style={{ borderColor: '#EEF2FF' }}>
            {Object.entries(SHEET_META).map(([key, { label }]) => (
              <Link key={key} href={`/admin/inventory/components?sheet=${key}`}
                className="text-xs font-medium transition-colors hover:underline"
                style={{ color: '#2563EB', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {label} →
              </Link>
            ))}
          </div>
        </div>

        {/* Low stock — redesigned */}
        <div className="md:col-span-3 rounded-xl border overflow-hidden" style={{ borderColor: '#DDE3F0', background: '#fff' }}>

          {/* Header with severity summary badges */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#F1F5FB' }}>
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748B', fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: '0.1em' }}>
                Low Stock Alerts
              </h2>
              {alerts.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: '#FEE2E2', color: '#DC2626' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                    {sortedAlerts.filter(a => Number(a.stock_quantity) === 0).length} out
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: '#FEF3C7', color: '#B45309' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                    {sortedAlerts.filter(a => Number(a.stock_quantity) > 0).length} low
                  </span>
                </div>
              )}
            </div>
            {alerts.length > 0 && (
              <Link href="/admin/inventory/alerts"
                className="text-xs font-medium hover:underline"
                style={{ color: '#2563EB', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                View all ({alerts.length}) →
              </Link>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 m-5 rounded-lg px-4 py-3"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="#16A34A" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              <span className="text-sm font-medium" style={{ color: '#15803D', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                All components adequately stocked
              </span>
            </div>
          ) : (
            <ul>
              {sortedAlerts.map((a, idx) => {
                const isZero = Number(a.stock_quantity) === 0
                const stripeColor = isZero ? '#DC2626' : '#D97706'
                const stockNum = Number(a.stock_quantity)
                const minNum = Number(a.min_stock)
                // Fill bar: how full relative to a reasonable max (min * 3 or 100, whichever is sensible)
                const barMax = Math.max(minNum * 3, stockNum, 1)
                const barPct = Math.min((stockNum / barMax) * 100, 100)

                return (
                  <li key={a.id}
                    className="flex items-stretch"
                    style={{ borderBottom: idx < sortedAlerts.length - 1 ? '1px solid #F8FAFF' : undefined }}>

                    {/* Severity stripe */}
                    <div className="w-[3px] shrink-0" style={{ background: stripeColor }} />

                    <div className="flex flex-1 items-center gap-3 px-4 py-3">
                      {/* Icon */}
                      <div className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ background: isZero ? '#FEF2F2' : '#FFFBEB' }}>
                        {isZero ? (
                          <svg className="h-4 w-4" fill="none" stroke="#DC2626" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="#D97706" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          </svg>
                        )}
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug truncate"
                          style={{ color: '#1E293B', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                          {a.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs rounded px-1.5 py-px"
                            style={{ fontFamily: "'IBM Plex Mono', monospace", background: '#EEF2FF', color: '#3730A3', border: '1px solid #C7D2FE' }}>
                            {a.sku}
                          </span>
                          {a.category && (
                            <span className="text-xs" style={{ color: '#94A3B8', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                              {a.category}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock reading + bar */}
                      <div className="shrink-0 text-right w-24">
                        <p className="text-sm font-bold tabular-nums"
                          style={{ color: isZero ? '#DC2626' : '#B45309', fontFamily: "'IBM Plex Mono', monospace" }}>
                          {stockNum.toLocaleString()}
                          <span className="text-xs font-normal ml-1" style={{ color: '#94A3B8' }}>{a.unit}</span>
                        </p>
                        {/* Mini fill bar */}
                        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${barPct}%`, background: isZero ? '#FCA5A5' : '#FCD34D' }} />
                        </div>
                        {minNum > 0 && (
                          <p className="text-xs mt-0.5 tabular-nums" style={{ color: '#CBD5E1', fontFamily: "'IBM Plex Mono', monospace" }}>
                            min {minNum.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Movements table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDE3F0', background: '#fff' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#EEF2FF' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748B', fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: '0.1em' }}>
            Recent Movements
          </h2>
          <span className="text-xs" style={{ color: '#CBD5E1', fontFamily: "'IBM Plex Mono', monospace" }}>last 12</span>
        </div>
        {movements.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: '#94A3B8', fontFamily: "'IBM Plex Sans', sans-serif" }}>
            No movements recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #EEF2FF', background: '#FAFBFF' }}>
                  {['Date', 'Component', 'Type', 'Qty', 'Reference'].map((h, i) => (
                    <th key={h} className={`px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${i === 3 ? 'text-right' : ''}`}
                      style={{ color: '#94A3B8', fontFamily: "'IBM Plex Sans', sans-serif", letterSpacing: '0.07em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => (
                  <tr key={m.id} style={{ borderBottom: i < movements.length - 1 ? '1px solid #F8FAFF' : undefined }}>
                    <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: '#94A3B8', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {new Date(m.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 max-w-[180px] truncate" style={{ color: '#334155', fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      {m.component?.name ?? m.component?.sku ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${MOVEMENT_CHIP[m.movement_type] ?? 'bg-slate-100 text-slate-600'}`}
                        style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums" style={{ color: '#0D1526', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {Number(m.quantity).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: '#CBD5E1', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {m.reference_type ?? '—'} {m.reference_id ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nav tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { href: '/admin/inventory/components', label: 'Components',      sub: 'Browse & adjust' },
          { href: '/admin/inventory/products',   label: 'Products',        sub: 'Finished goods' },
          { href: '/admin/inventory/bom',        label: 'Bill of Materials', sub: 'Component maps' },
          { href: '/admin/inventory/alerts',     label: 'Alerts',          sub: 'Reorder list' },
          { href: '/admin/orders/create',        label: 'Create Order',    sub: 'Consume stock' },
        ].map((n) => (
          <Link key={n.href} href={n.href}
            className="group rounded-xl border px-4 py-3.5 transition-all hover:shadow-sm"
            style={{ borderColor: '#DDE3F0', background: '#fff', fontFamily: "'IBM Plex Sans', sans-serif" }}>
            <p className="text-sm font-semibold group-hover:text-blue-600 transition-colors" style={{ color: '#1E293B' }}>{n.label}</p>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{n.sub}</p>
          </Link>
        ))}
      </div>

    </div>
  )
}
