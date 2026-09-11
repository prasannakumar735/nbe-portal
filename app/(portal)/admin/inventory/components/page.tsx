'use client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import type { ComponentRow } from '@/lib/types/inventory.types'

type MovementType = 'in' | 'out' | 'adjustment'
type SortKey = 'name' | 'sku' | 'stock_quantity' | 'category'
type SortDir = 'asc' | 'desc'

const SHEET_TABS = [
  { key: '', label: 'All' },
  { key: 'INVENTORY_RD', label: 'Rapid Door' },
  { key: 'INVENTORY_PVC', label: 'PVC Strip' },
  { key: 'INVENTORY_UF', label: 'Hardware' },
]

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
  const adjustRef = useRef<HTMLTableRowElement | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory/components', { cache: 'no-store' })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to load components')
      }
      const payload = await res.json()
      setComponents(payload.components ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load components')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const categories = useMemo(() => {
    const sheetItems = activeSheet ? components.filter((c) => c.source_sheet === activeSheet) : components
    const cats = Array.from(new Set(sheetItems.map((c) => c.category ?? '').filter(Boolean))).sort()
    return cats
  }, [components, activeSheet])

  const filtered = useMemo(() => {
    let list = components
    if (activeSheet) list = list.filter((c) => c.source_sheet === activeSheet)
    if (activeCategory) list = list.filter((c) => c.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.sku.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.mpn ?? '').toLowerCase().includes(q) ||
          (c.category ?? '').toLowerCase().includes(q),
      )
    }
    list = [...list].sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sort.key === 'stock_quantity') {
        va = Number(a.stock_quantity)
        vb = Number(b.stock_quantity)
        return sort.dir === 'asc' ? va - vb : vb - va
      }
      va = String(a[sort.key] ?? '').toLowerCase()
      vb = String(b[sort.key] ?? '').toLowerCase()
      return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    return list
  }, [components, activeSheet, activeCategory, search, sort])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
    setPage(0)
  }

  function handleSheetTab(key: string) {
    setActiveSheet(key)
    setActiveCategory('')
    setPage(0)
  }

  async function handleAdjust(componentId: string) {
    const qty = parseFloat(form.quantity)
    if (!qty || qty <= 0) { toast.error('Enter a positive quantity'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ component_id: componentId, movement_type: form.type, quantity: qty, note: form.note || undefined }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to record movement')
      }
      toast.success('Stock updated')
      setAdjusting(null)
      setForm({ type: 'in', quantity: '', note: '' })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record movement')
    } finally {
      setSubmitting(false)
    }
  }

  const lowCount = filtered.filter((c) => c.stock_quantity <= c.min_stock).length

  return (
    <div className="space-y-5">
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/inventory" className="hover:text-indigo-600 transition-colors">Inventory</Link>
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-800 font-medium">Components</span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Components</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} of {components.length} SKUs
            {lowCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {lowCount} low stock
              </span>
            )}
          </p>
        </div>
        {/* Search */}
        <div className="flex-1 min-w-[220px]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search SKU, name, MPN…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sheet Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {SHEET_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleSheetTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeSheet === tab.key
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
            {tab.key && (
              <span className="ml-1.5 text-xs text-slate-400">
                ({components.filter((c) => c.source_sheet === tab.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setActiveCategory(''); setPage(0) }}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              !activeCategory ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
            }`}
          >
            All categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setActiveCategory(cat); setPage(0) }}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <Th label="SKU" sortKey="sku" sort={sort} onSort={toggleSort} className="w-36" />
                  <Th label="Description" sortKey="name" sort={sort} onSort={toggleSort} />
                  <Th label="Category" sortKey="category" sort={sort} onSort={toggleSort} className="w-32" />
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-24">MPN</th>
                  <Th label="Stock" sortKey="stock_quantity" sort={sort} onSort={toggleSort} className="w-24 text-right" />
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-20 text-right">Min</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-16">Unit</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-20">Status</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                      No components match your filters.
                    </td>
                  </tr>
                )}
                {paginated.map((component) => {
                  const isLow = component.stock_quantity <= component.min_stock
                  const isAdj = adjusting === component.id
                  return (
                    <>
                      <tr
                        key={component.id}
                        className={`group transition-colors ${isAdj ? 'bg-indigo-50' : 'hover:bg-slate-50/60'}`}
                      >
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
                            {component.sku}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-800 max-w-[260px]">
                          <span className="line-clamp-2 leading-snug">{component.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          {component.category && (
                            <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                              {component.category}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {component.mpn ?? '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isLow ? 'text-amber-700' : 'text-slate-800'}`}>
                          {Number(component.stock_quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
                          {Number(component.min_stock).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{component.unit}</td>
                        <td className="px-4 py-3">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Low
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              OK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjusting(isAdj ? null : component.id)
                              setForm({ type: 'in', quantity: '', note: '' })
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isAdj
                                ? 'bg-indigo-200 text-indigo-800'
                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 group-hover:bg-indigo-100'
                            }`}
                          >
                            {isAdj ? 'Cancel' : 'Adjust'}
                          </button>
                        </td>
                      </tr>
                      {isAdj && (
                        <tr
                          key={`${component.id}-form`}
                          ref={adjustRef}
                          className="border-b border-indigo-200 bg-indigo-50/60"
                        >
                          <td colSpan={9} className="px-4 py-4">
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Movement Type</label>
                                <select
                                  value={form.type}
                                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MovementType }))}
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  <option value="in">📦 Stock In</option>
                                  <option value="out">📤 Stock Out</option>
                                  <option value="adjustment">🔧 Adjustment</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quantity</label>
                                <input
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  value={form.quantity}
                                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                                  placeholder="0.00"
                                  className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Note</label>
                                <input
                                  type="text"
                                  value={form.note}
                                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                                  placeholder="e.g. PO #1234, batch delivery"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => void handleAdjust(component.id)}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                              >
                                {submitting ? 'Saving…' : 'Save Movement'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 text-xs">
            Page {page + 1} of {totalPages} · {filtered.length} results
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageIdx = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i
              return (
                <button
                  key={pageIdx}
                  type="button"
                  onClick={() => setPage(pageIdx)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    pageIdx === page
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageIdx + 1}
                </button>
              )
            })}
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ label, sortKey, sort, onSort, className }: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; dir: SortDir }
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sort.key === sortKey
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 transition-colors ${className ?? ''}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
          {active && sort.dir === 'asc' ? '↑' : '↓'}
        </span>
      </span>
    </th>
  )
}
