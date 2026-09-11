'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import type { ComponentRow } from '@/lib/types/inventory.types'

type MovementType = 'in' | 'out' | 'adjustment'
type SortKey = 'name' | 'sku' | 'stock_quantity' | 'category'
type SortDir = 'asc' | 'desc'

const SHEET_TABS = [
  { key: '',             label: 'All'      },
  { key: 'INVENTORY_RD',  label: 'Rapid Door' },
  { key: 'INVENTORY_PVC', label: 'PVC Strip'  },
  { key: 'INVENTORY_UF',  label: 'Hardware'   },
]

const CAT_COLORS: Record<string, string> = {
  'G-Motor':      '#2563EB',
  'Frame':        '#0891B2',
  'Curtain':      '#7C3AED',
  'C-Box':        '#D97706',
  'D-Control':    '#059669',
  'Safety':       '#DC2626',
  'Cable':        '#64748B',
  'R-Drum':       '#9333EA',
  'Detec':        '#0F766E',
  'Hardware':     '#B45309',
  'Tools':        '#4F46E5',
  'Track':        '#0284C7',
  'Fitting':      '#7C3AED',
  'Hanger':       '#0891B2',
  'PVC Strip':    '#2563EB',
  'PVC Sheet':    '#7C3AED',
  'PVC Swing':    '#0F766E',
  'Frame/Curtain':'#D97706',
}

const PAGE_SIZE = 50

export default function InventoryComponentsPage() {
  const searchParams = useSearchParams()
  const [components, setComponents] = useState<ComponentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [form, setForm] = useState<{ type: MovementType; quantity: string; note: string }>({
    type: 'in', quantity: '', note: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [activeSheet, setActiveSheet] = useState(searchParams.get('sheet') ?? '')
  const [activeCategory, setActiveCategory] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(0)

  const load = useCallback(async () => {
    setIsLoading(true); setError(null)
    try {
      const res = await fetch('/api/inventory/components', { cache: 'no-store' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Load failed')
      setComponents((await res.json()).components ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const categories = useMemo(() => {
    const base = activeSheet ? components.filter(c => c.source_sheet === activeSheet) : components
    return Array.from(new Set(base.map(c => c.category ?? '').filter(Boolean))).sort()
  }, [components, activeSheet])

  const filtered = useMemo(() => {
    let list = components
    if (activeSheet) list = list.filter(c => c.source_sheet === activeSheet)
    if (activeCategory) list = list.filter(c => c.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.sku.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.mpn ?? '').toLowerCase().includes(q) ||
        (c.category ?? '').toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      if (sort.key === 'stock_quantity') {
        const d = Number(a.stock_quantity) - Number(b.stock_quantity)
        return sort.dir === 'asc' ? d : -d
      }
      const va = String(a[sort.key] ?? '').toLowerCase()
      const vb = String(b[sort.key] ?? '').toLowerCase()
      return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [components, activeSheet, activeCategory, search, sort])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const lowCount = filtered.filter(c => c.stock_quantity <= c.min_stock).length

  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
    setPage(0)
  }

  async function handleAdjust(id: string) {
    const qty = parseFloat(form.quantity)
    if (!qty || qty <= 0) { toast.error('Enter a positive quantity'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ component_id: id, movement_type: form.type, quantity: qty, note: form.note || undefined }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed')
      toast.success('Stock updated')
      setAdjusting(null)
      setForm({ type: 'in', quantity: '', note: '' })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const mono: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }
  const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans', sans-serif" }

  return (
    <div className="space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ ...sans, color: '#94A3B8' }}>
        <Link href="/admin/inventory" className="hover:text-blue-600 transition-colors" style={{ color: '#64748B' }}>
          Inventory
        </Link>
        <span>/</span>
        <span style={{ color: '#1E293B', fontWeight: 600 }}>Components</span>
      </div>

      {/* Title + search row */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ ...mono, color: '#2563EB', letterSpacing: '0.12em' }}>
            SKU Catalogue
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight" style={{ ...sans, color: '#0D1526' }}>
            Components
          </h1>
          <p className="text-xs mt-1" style={{ ...sans, color: '#94A3B8' }}>
            {filtered.length} of {components.length} SKUs
            {lowCount > 0 && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium"
                style={{ background: '#FEF3C7', color: '#92400E' }}>
                {lowCount} low stock
              </span>
            )}
          </p>
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" fill="none" stroke="#94A3B8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Search SKU, description, MPN…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="w-full rounded-lg py-2 pl-9 pr-8 text-sm outline-none transition-all"
              style={{ ...sans, border: '1px solid #DDE3F0', color: '#1E293B', background: '#fff',
                boxShadow: 'none' }}
              onFocus={e => e.currentTarget.style.borderColor = '#2563EB'}
              onBlur={e => e.currentTarget.style.borderColor = '#DDE3F0'}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#CBD5E1' }}>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sheet tabs */}
      <div style={{ borderBottom: '1px solid #DDE3F0' }}>
        <div className="flex gap-0">
          {SHEET_TABS.map(tab => {
            const count = tab.key ? components.filter(c => c.source_sheet === tab.key).length : components.length
            const active = activeSheet === tab.key
            return (
              <button key={tab.key} type="button"
                onClick={() => { setActiveSheet(tab.key); setActiveCategory(''); setPage(0) }}
                className="relative px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  ...sans,
                  color: active ? '#2563EB' : '#64748B',
                  borderBottom: active ? '2px solid #2563EB' : '2px solid transparent',
                  marginBottom: -1,
                }}>
                {tab.label}
                <span className="ml-1.5 text-xs rounded px-1.5 py-0.5"
                  style={{
                    ...mono,
                    background: active ? '#EFF6FF' : '#F1F5F9',
                    color: active ? '#1D4ED8' : '#94A3B8',
                  }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Category filter pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button"
            onClick={() => { setActiveCategory(''); setPage(0) }}
            className="rounded-full px-3 py-1 text-xs font-medium border transition-all"
            style={{
              ...sans,
              background: !activeCategory ? '#1E293B' : '#fff',
              color: !activeCategory ? '#F8FAFC' : '#64748B',
              borderColor: !activeCategory ? '#1E293B' : '#DDE3F0',
            }}>
            All
          </button>
          {categories.map(cat => {
            const active = activeCategory === cat
            const color = CAT_COLORS[cat] ?? '#64748B'
            return (
              <button key={cat} type="button"
                onClick={() => { setActiveCategory(cat); setPage(0) }}
                className="rounded-full px-3 py-1 text-xs font-medium border transition-all"
                style={{
                  ...sans,
                  background: active ? color : '#fff',
                  color: active ? '#fff' : '#64748B',
                  borderColor: active ? color : '#DDE3F0',
                }}>
                {cat}
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" style={sans}>{error}</div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#DDE3F0', background: '#fff' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-sm" style={{ ...sans, color: '#94A3B8' }}>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #EEF2FF' }}>
                  {/* status stripe col */}
                  <th className="w-1" />
                  <SortTh label="SKU"         sortKey="sku"           sort={sort} onSort={toggleSort} className="w-36 pl-4" />
                  <SortTh label="Description" sortKey="name"          sort={sort} onSort={toggleSort} />
                  <SortTh label="Category"    sortKey="category"      sort={sort} onSort={toggleSort} className="w-32" />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-32"
                    style={{ ...sans, color: '#94A3B8', letterSpacing: '0.07em' }}>MPN</th>
                  <SortTh label="Stock" sortKey="stock_quantity" sort={sort} onSort={toggleSort} className="w-28 text-right pr-4" />
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider w-16"
                    style={{ ...sans, color: '#94A3B8', letterSpacing: '0.07em' }}>Min</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-14"
                    style={{ ...sans, color: '#94A3B8', letterSpacing: '0.07em' }}>Unit</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-sm" style={{ ...sans, color: '#94A3B8' }}>
                      No components match your filters.
                    </td>
                  </tr>
                )}
                {paginated.map((c) => {
                  const isLow = c.stock_quantity <= c.min_stock
                  const isZero = Number(c.stock_quantity) === 0
                  const isAdj = adjusting === c.id
                  const catColor = CAT_COLORS[c.category ?? ''] ?? '#CBD5E1'
                  const stripeColor = isZero ? '#DC2626' : isLow ? '#D97706' : '#10B981'

                  return (
                    <React.Fragment key={c.id}>
                      <tr
                        className="transition-colors"
                        style={{
                          borderBottom: '1px solid #F1F5FB',
                          background: isAdj ? '#F8FAFF' : undefined,
                        }}
                        onMouseEnter={e => { if (!isAdj) (e.currentTarget as HTMLElement).style.background = '#FAFBFF' }}
                        onMouseLeave={e => { if (!isAdj) (e.currentTarget as HTMLElement).style.background = '' }}
                      >
                        {/* Severity stripe */}
                        <td className="p-0 w-1">
                          <div className="w-[3px] min-h-[44px] h-full" style={{ background: stripeColor }} />
                        </td>

                        {/* SKU */}
                        <td className="pl-4 pr-2 py-3">
                          <span className="inline-block rounded px-2 py-0.5 text-xs"
                            style={{ ...mono, background: '#1E2B3C', color: '#93C5FD', letterSpacing: '0.02em' }}>
                            {c.sku}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3 max-w-[260px]">
                          <span className="line-clamp-2 leading-snug text-sm" style={{ ...sans, color: '#334155' }}>
                            {c.name}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3">
                          {c.category && (
                            <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-0.5"
                              style={{ ...sans, background: `${catColor}14`, color: catColor, border: `1px solid ${catColor}30` }}>
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: catColor }} />
                              {c.category}
                            </span>
                          )}
                        </td>

                        {/* MPN */}
                        <td className="px-4 py-3 text-xs" style={{ ...mono, color: '#94A3B8' }}>
                          {c.mpn || '—'}
                        </td>

                        {/* Stock */}
                        <td className="px-4 py-3 text-right pr-4">
                          <span className="text-sm font-bold tabular-nums"
                            style={{ ...mono, color: isZero ? '#DC2626' : isLow ? '#D97706' : '#0D1526' }}>
                            {Number(c.stock_quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Min */}
                        <td className="px-4 py-3 text-right text-xs tabular-nums" style={{ ...mono, color: '#CBD5E1' }}>
                          {Number(c.min_stock).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>

                        {/* Unit */}
                        <td className="px-4 py-3 text-xs" style={{ ...sans, color: '#94A3B8' }}>
                          {c.unit}
                        </td>

                        {/* Adjust toggle */}
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            title={isAdj ? 'Cancel' : 'Adjust stock'}
                            onClick={() => {
                              setAdjusting(isAdj ? null : c.id)
                              setForm({ type: 'in', quantity: '', note: '' })
                            }}
                            className="rounded-lg p-1.5 transition-colors"
                            style={{
                              color: isAdj ? '#2563EB' : '#94A3B8',
                              background: isAdj ? '#EFF6FF' : undefined,
                            }}>
                            {isAdj ? (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Adjust form row */}
                      {isAdj && (
                        <tr style={{ background: '#F0F6FF', borderBottom: '1px solid #BFDBFE' }}>
                          <td className="p-0 w-1">
                            <div className="w-[3px] min-h-full" style={{ background: '#2563EB' }} />
                          </td>
                          <td colSpan={8} className="px-5 py-4">
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ ...sans, color: '#475569' }}>
                                  Type
                                </label>
                                <select
                                  value={form.type}
                                  onChange={e => setForm(f => ({ ...f, type: e.target.value as MovementType }))}
                                  className="rounded-lg py-2 px-3 text-sm outline-none"
                                  style={{ ...sans, border: '1px solid #CBD5E1', color: '#1E293B', background: '#fff' }}>
                                  <option value="in">Stock In</option>
                                  <option value="out">Stock Out</option>
                                  <option value="adjustment">Adjustment</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ ...sans, color: '#475569' }}>
                                  Quantity
                                </label>
                                <input
                                  type="number" min="0.001" step="0.001"
                                  value={form.quantity}
                                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                                  placeholder="0.00"
                                  className="w-28 rounded-lg py-2 px-3 text-sm outline-none"
                                  style={{ ...mono, border: '1px solid #CBD5E1', color: '#1E293B', background: '#fff' }}
                                />
                              </div>
                              <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-semibold mb-1.5" style={{ ...sans, color: '#475569' }}>
                                  Note
                                </label>
                                <input
                                  type="text"
                                  value={form.note}
                                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                  placeholder="e.g. PO #1234, batch received"
                                  className="w-full rounded-lg py-2 px-3 text-sm outline-none"
                                  style={{ ...sans, border: '1px solid #CBD5E1', color: '#1E293B', background: '#fff' }}
                                />
                              </div>
                              <button
                                type="button" disabled={submitting}
                                onClick={() => void handleAdjust(c.id)}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                                style={{ ...sans, background: '#2563EB' }}>
                                {submitting ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ ...mono, color: '#94A3B8' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <PageBtn label="←" disabled={page === 0} onClick={() => setPage(p => p - 1)} mono={mono} sans={sans} />
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const idx = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i
              return (
                <PageBtn key={idx} label={String(idx + 1)} active={idx === page}
                  onClick={() => setPage(idx)} mono={mono} sans={sans} />
              )
            })}
            <PageBtn label="→" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} mono={mono} sans={sans} />
          </div>
        </div>
      )}

    </div>
  )
}

function SortTh({ label, sortKey, sort, onSort, className }: {
  label: string; sortKey: SortKey
  sort: { key: SortKey; dir: SortDir }; onSort: (k: SortKey) => void; className?: string
}) {
  const active = sort.key === sortKey
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-slate-700 ${className ?? ''}`}
      style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: active ? '#2563EB' : '#94A3B8', letterSpacing: '0.07em' }}
      onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span style={{ opacity: 0.7 }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  )
}

function PageBtn({ label, active, disabled, onClick, mono, sans }: {
  label: string; active?: boolean; disabled?: boolean
  onClick: () => void
  mono: React.CSSProperties; sans: React.CSSProperties
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40"
      style={{
        ...mono,
        background: active ? '#2563EB' : '#fff',
        color: active ? '#fff' : '#64748B',
        border: active ? '1px solid #2563EB' : '1px solid #DDE3F0',
      }}>
      {label}
    </button>
  )
}
