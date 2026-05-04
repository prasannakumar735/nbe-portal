const EMPTY_MARKERS = new Set(['', '—', '-', '–'])

/** Display / export: empty or legacy “No task” → N/A (does not change stored DB values). */
export function formatTaskLabel(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim()
  if (!t || EMPTY_MARKERS.has(t) || /^no task$/i.test(t)) return 'N/A'
  return t
}
