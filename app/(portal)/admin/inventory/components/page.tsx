'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ComponentRow } from '@/lib/types/inventory.types'

type MovementType = 'in' | 'out' | 'adjustment'

export default function InventoryComponentsPage() {
  const [components, setComponents] = useState<ComponentRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [form, setForm] = useState<{ type: MovementType; quantity: string; note: string }>({
    type: 'in',
    quantity: '',
    note: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch('/api/inventory/components', { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to load components')
      }
      const payload = await response.json()
      setComponents(payload.components ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load components')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleAdjust(componentId: string) {
    const qty = parseFloat(form.quantity)
    if (!qty || qty <= 0) {
      toast.error('Enter a positive quantity')
      return
    }
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

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/admin/inventory" className="text-indigo-600 hover:underline">← Inventory</Link>
      </div>

      <h1 className="text-xl font-bold text-slate-900">Inventory Components</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Min Stock</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => {
              const isLow = component.stock_quantity <= component.min_stock
              return (
                <>
                  <tr key={component.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{component.sku}</td>
                    <td className="px-3 py-2 text-slate-700">{component.name}</td>
                    <td className={`px-3 py-2 font-medium ${isLow ? 'text-amber-700' : 'text-slate-700'}`}>
                      {Number(component.stock_quantity).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{Number(component.min_stock).toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-700">{component.unit}</td>
                    <td className="px-3 py-2">
                      {isLow ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Low</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">OK</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setAdjusting(adjusting === component.id ? null : component.id)}
                        className="rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        Adjust stock
                      </button>
                    </td>
                  </tr>
                  {adjusting === component.id && (
                    <tr key={`${component.id}-form`} className="border-b border-indigo-100 bg-indigo-50">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                            <select
                              value={form.type}
                              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MovementType }))}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                            >
                              <option value="in">Stock In</option>
                              <option value="out">Stock Out</option>
                              <option value="adjustment">Adjustment</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={form.quantity}
                              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                              placeholder="0.00"
                              className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                            />
                          </div>
                          <div className="flex-1 min-w-40">
                            <label className="block text-xs font-medium text-slate-700 mb-1">Note (optional)</label>
                            <input
                              type="text"
                              value={form.note}
                              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                              placeholder="e.g. Purchase order #123"
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void handleAdjust(component.id)}
                            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {submitting ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjusting(null)}
                            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
            {components.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">No components found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
