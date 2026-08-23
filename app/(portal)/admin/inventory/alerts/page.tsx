'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ComponentRow } from '@/lib/types/inventory.types'

export default function InventoryAlertsPage() {
  const [alerts, setAlerts] = useState<ComponentRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/inventory/alerts', { cache: 'no-store' })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || 'Failed to load alerts')
        }
        const payload = await response.json()
        if (!cancelled) setAlerts(payload.alerts ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load alerts')
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

      <h1 className="text-xl font-bold text-slate-900">Low Stock Alerts</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            No active low stock alerts.
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="font-semibold">{alert.name}</span> ({alert.sku}) — stock{' '}
              <span className="font-bold">{Number(alert.stock_quantity).toFixed(2)}</span> {alert.unit}, min{' '}
              {Number(alert.min_stock).toFixed(2)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
