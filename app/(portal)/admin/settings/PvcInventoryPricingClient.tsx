'use client'
import { useCallback, useEffect, useState } from 'react'

const INPUT_CLS = 'w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm font-mono text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'

type BulkRollRow = {
  id: string; grade: string; strip_width: number; thickness: number
  actual_cost: number; sales_fee: number; company_fee: number; shipping_fee: number; total_cost_default: number
}
type HeadrailRow = {
  id: string; material: string; length: string
  actual_cost: number; sales_fee: number; company_fee: number; shipping_fee: number; total_cost_default: number
}
type RivetPlateRow = {
  id: string; material: string; size: string
  actual_cost: number; sales_fee: number; company_fee: number; shipping_fee: number; total_cost_default: number
}

type EditMap = Record<string, Record<string, string>>

const PRICE_FIELDS: { key: string; label: string }[] = [
  { key: 'actual_cost',        label: 'Actual Cost' },
  { key: 'sales_fee',          label: 'Sales Fee' },
  { key: 'company_fee',        label: 'Company Fee' },
  { key: 'shipping_fee',       label: 'Shipping Fee' },
  { key: 'total_cost_default', label: 'Sell Price (100%)' },
]

function PriceTable<T extends { id: string }>({
  title,
  rows,
  labelFn,
  tableKey,
  onSave,
}: {
  title: string
  rows: T[]
  labelFn: (r: T) => string
  tableKey: 'bulk_roll' | 'headrail' | 'rivet_plates'
  onSave: (table: string, id: string, updates: Record<string, number>) => Promise<void>
}) {
  const [edits, setEdits] = useState<EditMap>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [msgs,   setMsgs]   = useState<Record<string, { ok: boolean; text: string }>>({})

  function getValue(row: T, field: string): string {
    const e = edits[row.id]?.[field]
    if (e !== undefined) return e
    return String((row as Record<string, unknown>)[field] ?? '')
  }

  function setField(id: string, field: string, val: string) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }))
  }

  async function save(row: T) {
    const rowEdits = edits[row.id]
    if (!rowEdits || Object.keys(rowEdits).length === 0) return
    setSaving(row.id)
    setMsgs(prev => ({ ...prev, [row.id]: { ok: false, text: '' } }))
    try {
      const updates: Record<string, number> = {}
      for (const [k, v] of Object.entries(rowEdits)) {
        const n = parseFloat(v)
        if (!isNaN(n)) updates[k] = n
      }
      await onSave(tableKey, row.id, updates)
      setEdits(prev => { const next = { ...prev }; delete next[row.id]; return next })
      setMsgs(prev => ({ ...prev, [row.id]: { ok: true, text: 'Saved' } }))
    } catch {
      setMsgs(prev => ({ ...prev, [row.id]: { ok: false, text: 'Save failed' } }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-500 min-w-[140px]">Variant</th>
              {PRICE_FIELDS.map(f => (
                <th key={f.key} className="text-right px-3 py-2 font-semibold text-slate-500 min-w-[110px]">{f.label}</th>
              ))}
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => {
              const dirty = !!(edits[row.id] && Object.keys(edits[row.id]).length > 0)
              const msg = msgs[row.id]
              return (
                <tr key={row.id} className={dirty ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2 font-medium text-slate-700">{labelFn(row)}</td>
                  {PRICE_FIELDS.map(f => (
                    <td key={f.key} className="px-3 py-1.5">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={getValue(row, f.key)}
                          onChange={e => setField(row.id, f.key, e.target.value)}
                          className={INPUT_CLS + ' pl-5 text-right'}
                        />
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right">
                    {dirty ? (
                      <button
                        type="button"
                        onClick={() => save(row)}
                        disabled={saving === row.id}
                        className="rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
                      >
                        {saving === row.id ? '…' : 'Save'}
                      </button>
                    ) : msg?.text ? (
                      <span className={`text-[11px] font-medium ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PvcInventoryPricingClient() {
  const [bulkRoll,    setBulkRoll]    = useState<BulkRollRow[]>([])
  const [headrail,    setHeadrail]    = useState<HeadrailRow[]>([])
  const [rivetPlates, setRivetPlates] = useState<RivetPlateRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/pvc-inventory-pricing')
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setBulkRoll(json.bulk_roll)
      setHeadrail(json.headrail)
      setRivetPlates(json.rivet_plates)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(table: string, id: string, updates: Record<string, number>) {
    const res = await fetch('/api/admin/pvc-inventory-pricing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id, updates }),
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error ?? 'Save failed')
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-slate-400">Loading pricing data…</div>
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error} — <button className="underline" onClick={load}>Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-slate-800">PVC Inventory Pricing</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Edit pricing for Bulk Roll, Headrail Only, and Rivet Plate inventory items.
          The <strong>Sell Price (100%)</strong> column is what customers see at the default markup.
          Changes take effect immediately.
        </p>
      </div>

      <PriceTable
        title="Bulk Roll (per 50m roll)"
        rows={bulkRoll}
        tableKey="bulk_roll"
        labelFn={r => `${r.grade} ${r.strip_width}mm / ${r.thickness}mm`}
        onSave={handleSave}
      />

      <PriceTable
        title="Headrail Only"
        rows={headrail}
        tableKey="headrail"
        labelFn={r => `${r.material} ${r.length}`}
        onSave={handleSave}
      />

      <PriceTable
        title="Rivet Plates"
        rows={rivetPlates}
        tableKey="rivet_plates"
        labelFn={r => `${r.material} ${r.size}`}
        onSave={handleSave}
      />
    </div>
  )
}
