/** Supabase / JSON may return duration as string — always coerce before math. */
export function coerceDurationMinutes(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v))
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

/** Parse HH:MM or HH:MM:SS from DB `time` column. */
export function parseDbTimeToMinutes(t: string | null | undefined): number | null {
  if (t == null || t === '') return null
  const parts = String(t).split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parseInt(parts[1] ?? '0', 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}
