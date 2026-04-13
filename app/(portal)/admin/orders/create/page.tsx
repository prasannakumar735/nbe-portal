'use client'

import { useEffect, useMemo, useState } from 'react'

type ProductRow = {
  product_id: string
  product_name: string
}

type PreviewItem = {
  component_id: string
  component_name: string
  sku: string
  required_qty: number
  available_qty: number
  remaining_qty: number
  status: 'ok' | 'low' | 'insufficient'
}

function StatusBadge({ status }: { status: PreviewItem['status'] }) {
  if (status === 'ok') {
    return <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">ok</span>
  }
  if (status === 'low') {
    return <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">low</span>
  }
  return <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">insufficient</span>
}

export default function AdminOrderCreatePage() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [orderReference, setOrderReference] = useState('')

  const [preview, setPreview] = useState<PreviewItem[]>([])
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
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

    void loadProducts()

    return () => {
      cancelled = true
    }
  }, [])

  const hasInsufficient = useMemo(() => preview.some((item) => item.status === 'insufficient'), [preview])

  async function loadPreview() {
    setError(null)
    setSuccessMessage(null)

    if (!productId || !quantity || quantity <= 0) {
      setError('Please select a product and enter a valid quantity.')
      return
    }

    setIsPreviewLoading(true)
    try {
      const response = await fetch('/api/inventory/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, quantity }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load component requirement preview')
      }

      setPreview(payload.components ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load component requirement preview')
      setPreview([])
    } finally {
      setIsPreviewLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!preview.length) {
      setError('Run Component Requirement Preview before submitting the order.')
      return
    }

    if (hasInsufficient) {
      setError('Order cannot be submitted because one or more components are insufficient.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          quantity,
          order_reference: orderReference || undefined,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create order')
      }

      setSuccessMessage(`Order ${payload.order_reference} created successfully. Inventory deducted and movements logged.`)
      setPreview(payload.components ?? preview)
      if (!orderReference) {
        setOrderReference(payload.order_reference)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Create Order</h1>
        <p className="mt-0.5 text-xs text-slate-600">Create customer order with BOM-based inventory validation and deduction.</p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Product
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3"
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.product_id} value={product.product_id}>
                  {product.product_name} ({product.product_id})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Quantity
            <input
              type="number"
              min={1}
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Order Reference (optional)
            <input
              type="text"
              value={orderReference}
              onChange={(event) => setOrderReference(event.target.value)}
              placeholder="ORD-2026-001"
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadPreview}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            disabled={isPreviewLoading}
          >
            {isPreviewLoading ? 'Loading Preview...' : 'Component Requirement Preview'}
          </button>
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
            disabled={isSubmitting || !preview.length || hasInsufficient}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {successMessage && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</div>}
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Component Requirement Preview</h2>
        {preview.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No preview data yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">Component</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Required</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((item) => (
                  <tr key={item.component_id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{item.component_name}</td>
                    <td className="px-3 py-2 text-slate-700">{item.sku}</td>
                    <td className="px-3 py-2 text-slate-700">{Number(item.required_qty).toFixed(3)}</td>
                    <td className="px-3 py-2 text-slate-700">{Number(item.available_qty).toFixed(3)}</td>
                    <td className="px-3 py-2 text-slate-700">{Number(item.remaining_qty).toFixed(3)}</td>
                    <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
