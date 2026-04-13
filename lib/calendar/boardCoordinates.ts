import { CALENDAR_DAY_END_HOUR, CALENDAR_DAY_START_HOUR } from '@/lib/constants'

export const SNAP_MINUTES = 15

export const DAY_START_MIN = CALENDAR_DAY_START_HOUR * 60
export const DAY_END_MIN = CALENDAR_DAY_END_HOUR * 60

export function snapMinutes(m: number, step: number = SNAP_MINUTES): number {
  return Math.round(m / step) * step
}

/** Map Y offset inside the day body to minutes from midnight. */
export function yPxToMinutesFromMidnight(yPx: number, bodyHeightPx: number): number {
  if (bodyHeightPx <= 0) return DAY_START_MIN
  const span = DAY_END_MIN - DAY_START_MIN
  const ratio = Math.max(0, Math.min(1, yPx / bodyHeightPx))
  return DAY_START_MIN + ratio * span
}

/** Top offset in px for an interval starting at `startMin` (minutes from midnight). */
export function minutesToTopPx(
  startMin: number,
  bodyHeightPx: number,
  dayStartMin: number = DAY_START_MIN,
  dayEndMin: number = DAY_END_MIN
): number {
  const span = dayEndMin - dayStartMin
  if (span <= 0) return 0
  return ((startMin - dayStartMin) / span) * bodyHeightPx
}

/** Height in px for a block spanning `blockMinutes` on the board. */
export function blockMinutesToHeightPx(blockMinutes: number, bodyHeightPx: number): number {
  const span = DAY_END_MIN - DAY_START_MIN
  if (span <= 0) return 0
  return (blockMinutes / span) * bodyHeightPx
}

/** Clamp snapped start so a timed block still begins within the working grid. */
export function clampStartMinutesForBoard(startMin: number, workMinutes: number, travelMinutes: number): number {
  const total = workMinutes + travelMinutes
  const maxStart = Math.max(DAY_START_MIN, DAY_END_MIN - total)
  const s = snapMinutes(startMin)
  return Math.min(Math.max(s, DAY_START_MIN), maxStart)
}

/** Postgres `time` string HH:MM:SS */
export function minutesToPgTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = ((mins % 60) + 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}
