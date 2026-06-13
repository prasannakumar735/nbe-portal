/** Whole minutes between two instants (floor). */
export function grossMinutesBetween(clockIn: Date, clockOut: Date): number {
  const ms = clockOut.getTime() - clockIn.getTime()
  if (ms <= 0) return 0
  return Math.floor(ms / (60 * 1000))
}

/** Human duration e.g. 8h 54m, 45m, 1h */
export function formatDurationHm(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes))
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}
