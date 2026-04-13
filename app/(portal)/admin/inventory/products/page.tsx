'use client'

import { useEffect, useState } from 'react'

type ProductRow = {
  product_id: string
  product_name: string
}

export default function InventoryProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/inventory/products', { cache: 'no-store' })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || 'Failed to load products')
        }
        const payload = await response.json()
        if (!cancelled) setProducts(payload.products ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load products')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="w-full">
      <h1 className="text-xl font-bold text-slate-900">Inventory Products</h1>
      <p className="mt-0.5 text-xs text-slate-600">Products with active BOM entries.</p>
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div>}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2">Product ID</th>
              <th className="px-3 py-2">Product Name</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.product_id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{product.product_id}</td>
                <td className="px-3 py-2 text-slate-700">{product.product_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
