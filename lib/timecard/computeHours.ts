/** Normalize "09:00:00" or "09:00" to minutes from midnight */
export function timeStringToMinutes(value: string): number {
  const raw = value.trim().slice(0, 8)
  const parts = raw.split(':').map(p => parseInt(p, 10))
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  const s = parts[2] ?? 0
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN
  return h * 60 + m + (Number.isFinite(s) ? s / 60 : 0)
}

export function formatMinutesAsTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function computeEntryTotalHours(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): { hours: number; error: string | null } {
  const start = timeStringToMinutes(startTime)
  const end = timeStringToMinutes(endTime)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { hours: 0, error: 'Invalid start or end time' }
  }
  if (end <= start) {
    return { hours: 0, error: 'End time must be after start time' }
  }
  const gross = end - start
  if (breakMinutes < 0) {
    return { hours: 0, error: 'Break cannot be negative' }
  }
  if (breakMinutes > gross) {
    return { hours: 0, error: 'Break is longer than worked time' }
  }
  const netMinutes = gross - breakMinutes
  return { hours: Math.round((netMinutes / 60) * 10000) / 10000, error: null }
}
