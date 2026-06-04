import type { ServiceLineItem } from '@/components/quotes/types'

/** Explicit manual line total only — ignores null/NaN/empty (avoids Number(null) → 0). */
export function parseLineTotalOverride(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return undefined
  return n
}

export function hasLineTotalOverride(item: { totalOverride?: unknown }): boolean {
  return parseLineTotalOverride(item.totalOverride) !== undefined
}

export function lineItemRowTotal(item: {
  qty?: number
  unitPrice?: number
  totalOverride?: unknown
}): number {
  const override = parseLineTotalOverride(item.totalOverride)
  const qty = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0
  const unit = Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : 0
  if (override !== undefined) return override
  return qty * unit
}

const OVERRIDE_EPSILON = 0.005

/** Strip inactive overrides before persisting form_snapshot. */
export function sanitizeServiceLineItemForSnapshot(item: ServiceLineItem): ServiceLineItem {
  const qty = Number.isFinite(Number(item.qty)) ? Number(item.qty) : 1
  const unitPrice = Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : 0
  let totalOverride = parseLineTotalOverride(item.totalOverride)
  const computed = qty * unitPrice
  if (
    totalOverride !== undefined &&
    Math.abs(totalOverride - computed) < OVERRIDE_EPSILON
  ) {
    totalOverride = undefined
  }

  const title = item.itemTitle?.trim()
  const out: ServiceLineItem = {
    itemTitle: title ? String(item.itemTitle) : undefined,
    sno: item.sno?.trim() ? String(item.sno) : undefined,
    description: String(item.description ?? ''),
    width: String(item.width ?? ''),
    height: String(item.height ?? ''),
    qty,
    unitPrice,
    itemNotes: item.itemNotes?.trim() ? String(item.itemNotes) : undefined,
  }
  if (totalOverride !== undefined) out.totalOverride = totalOverride
  return out
}
