'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ComponentRow = {
  id: string
  sku: string
  name: string
  unit: string
  stock_quantity: number
  min_stock: number
}

type MovementRow = {
  id: string
  movement_type: string
  quantity: number
  reference_type: string | null
  reference_id: string | null
  created_at: string
  component?: { name: string; sku: string }
}

export default function InventoryDashboardPage() {
  const [components, setComponents] = useState<ComponentRow[]>([])
  const [alerts, setAlerts] = useState<ComponentRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadInventory() {
      try {
        const results = await Promise.allSettled([
          fetch('/api/inventory/components', { cache: 'no-store' }),
          fetch('/api/inventory/alerts', { cache: 'no-store' }),
          fetch('/api/inventory/movements?limit=20', { cache: 'no-store' }),
        ])

        const [componentsResult, alertsResult, movementsResult] = results

        const componentsRes = componentsResult.status === 'fulfilled' ? componentsResult.value : null
        const alertsRes = alertsResult.status === 'fulfilled' ? alertsResult.value : null
        const movementsRes = movementsResult.status === 'fulfilled' ? movementsResult.value : null

        if (componentsResult.status === 'rejected') {
          console.error('Failed to fetch components:', componentsResult.reason)
        }
        if (alertsResult.status === 'rejected') {
          console.error('Failed to fetch alerts:', alertsResult.reason)
        }
        if (movementsResult.status === 'rejected') {
          console.error('Failed to fetch movements:', movementsResult.reason)
        }

        if (!componentsRes || !componentsRes.ok) {
          const fallbackError = 'Failed to load inventory dashboard data: components are unavailable.'
          setError(fallbackError)
          return
        }

        const componentsData = await componentsRes.json()
        let alertsData: { alerts?: ComponentRow[] } | ComponentRow[] = []
        if (alertsRes?.ok) {
          alertsData = await alertsRes.json()
        }

        let movementsData: { movements?: MovementRow[] } = { movements: [] }
        if (movementsRes?.ok) {
          movementsData = await movementsRes.json()
        }

        if (cancelled) return

        setComponents(componentsData.components ?? [])
        setAlerts(Array.isArray(alertsData) ? alertsData : (alertsData.alerts ?? []))
        setMovements(movementsData.movements ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load inventory dashboard data')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadInventory()
    return () => {
      cancelled = true
    }
  }, [])

  const dashboard = useMemo(() => {
    const totalStock = components.reduce((acc, item) => acc + Number(item.stock_quantity ?? 0), 0)
    return {
      totalComponents: components.length,
      lowStockCount: alerts.length,
      movementCount: movements.length,
      totalStock,
    }
  }, [components, alerts, movements])

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-6 py-8 text-slate-600">Loading inventory...</div>
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
        <p className="mt-1 text-sm text-slate-600">BOM-based stock control for rapid roller door orders.</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/inventory/components" className="text-indigo-700 underline">Components</Link>
          <Link href="/admin/inventory/products" className="text-indigo-700 underline">Products</Link>
          <Link href="/admin/inventory/bom" className="text-indigo-700 underline">BOM</Link>
          <Link href="/admin/inventory/alerts" className="text-indigo-700 underline">Alerts</Link>
          <Link href="/admin/orders/create" className="text-indigo-700 underline">Create Order</Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total Components</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.totalComponents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Low Stock Alerts</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{dashboard.lowStockCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Recent Movements</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.movementCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total Stock Qty</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dashboard.totalStock.toFixed(2)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Components Table</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">Min</th>
                <th className="px-3 py-2">Unit</th>
              </tr>
            </thead>
            <tbody>
              {components.slice(0, 10).map((component) => (
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
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Low Stock Alerts</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No low stock alerts.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {alerts.slice(0, 10).map((alert) => (
              <li key={alert.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                {alert.name} ({alert.sku}) - {Number(alert.stock_quantity).toFixed(2)} / min {Number(alert.min_stock).toFixed(2)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Stock Movement History</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Component</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{new Date(movement.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-700">{movement.component?.name ?? movement.component?.sku ?? '-'}</td>
                  <td className="px-3 py-2 text-slate-700">{movement.movement_type}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{Number(movement.quantity).toFixed(2)}</td>
                  <td className="px-3 py-2 text-slate-700">{movement.reference_type ?? '-'} {movement.reference_id ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
