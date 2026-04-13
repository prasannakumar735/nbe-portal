/** en-AU display without seconds (e.g. maintenance / merged report lists). */
export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
