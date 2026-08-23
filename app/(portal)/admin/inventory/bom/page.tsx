'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { BomRow } from '@/lib/types/inventory.types'

export default function InventoryBomPage() {
  const [rows, setRows] = useState<BomRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/inventory/bom', { cache: 'no-store' })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || 'Failed to load BOM')
        }
        const payload = await response.json()
        if (!cancelled) setRows(payload.bom ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load BOM')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/admin/inventory" className="text-indigo-600 hover:underline">← Inventory</Link>
      </div>

      <h1 className="text-xl font-bold text-slate-900">Bill of Materials</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Component</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Qty / Unit</th>
              <th className="px-3 py-2">Wastage %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-800">{row.product_name || row.product_id}</td>
                <td className="px-3 py-2 text-slate-700">{row.component?.name || '-'}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.component?.sku || '-'}</td>
                <td className="px-3 py-2 text-slate-700">
                  {Number(row.quantity_per_unit).toFixed(3)} {row.component?.unit || ''}
                </td>
                <td className="px-3 py-2 text-slate-700">{Number(row.wastage_percentage).toFixed(2)}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">No BOM entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
