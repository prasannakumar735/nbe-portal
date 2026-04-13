'use client'

import { useEffect, useState } from 'react'

type ComponentRow = {
  id: string
  sku: string
  name: string
  unit: string
  stock_quantity: number
  min_stock: number
}

export default function InventoryComponentsPage() {
  const [components, setComponents] = useState<ComponentRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/inventory/components', { cache: 'no-store' })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || 'Failed to load components')
        }
        const payload = await response.json()
        if (!cancelled) setComponents(payload.components ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load components')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="w-full">
      <h1 className="text-xl font-bold text-slate-900">Inventory Components</h1>
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div>}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Min Stock</th>
              <th className="px-3 py-2">Unit</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{component.sku}</td>
                <td className="px-3 py-2 text-slate-700">{component.name}</td>
                <td className="px-3 py-2 text-slate-700">{Number(component.stock_quantity).toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-700">{Number(component.min_stock).toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-700">{component.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
