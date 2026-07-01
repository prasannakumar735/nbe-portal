/** Sort key for labels like "Door 1", "Door 10" (numeric order, not lexicographic). */
export function doorLabelOrderKey(value: unknown): { n: number; raw: string } {
  const raw = String(value ?? '').trim()
  const m = raw.match(/\d+/)
  const n = m ? Number.parseInt(m[0]!, 10) : Number.NaN
  return { n: Number.isFinite(n) ? n : Number.POSITIVE_INFINITY, raw }
}

export function compareDoorLabels(a: string, b: string): number {
  const ak = doorLabelOrderKey(a)
  const bk = doorLabelOrderKey(b)
  if (ak.n !== bk.n) return ak.n - bk.n
  return ak.raw.localeCompare(bk.raw, undefined, { numeric: true, sensitivity: 'base' })
}

export function compareDoorRecordsByLabel(
  a: { door_label: string },
  b: { door_label: string },
): number {
  return compareDoorLabels(a.door_label, b.door_label)
}
