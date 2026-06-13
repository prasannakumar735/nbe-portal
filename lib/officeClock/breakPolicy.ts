import { timeStringToMinutes } from '@/lib/timecard/computeHours'

/** Tiered unpaid break from gross on-site minutes (office clock + modal auto-break). */
export function officeClockBreakForGrossMinutes(grossMinutes: number): number {
  const g = Math.max(0, Math.floor(grossMinutes))
  if (g < 120) return 0
  if (g < 300) return 15
  return 30
}

export function officeClockBreakForTimeRange(startHHmm: string, endHHmm: string): number {
  const startM = timeStringToMinutes(startHHmm)
  const endM = timeStringToMinutes(endHHmm)
  if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) return 0
  return officeClockBreakForGrossMinutes(endM - startM)
}
