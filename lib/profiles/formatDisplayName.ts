export function formatProfileDisplayName(row: {
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
} | null | undefined): string {
  if (!row) return '—'
  const full = String(row.full_name ?? '').trim()
  if (full) return full
  const parts = [row.first_name, row.last_name].map((s) => String(s ?? '').trim()).filter(Boolean)
  return parts.join(' ') || '—'
}
