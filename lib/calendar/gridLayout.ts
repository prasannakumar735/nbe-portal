/**
 * Vertical offset (px) for an event whose start is `startMinutesFromMidnight`,
 * relative to `dayStartMinutes` (e.g. 7:00 → 420).
 */
export function getEventTopPx(params: {
  startMinutesFromMidnight: number
  dayStartMinutes: number
  slotMinutes: number
  slotHeightPx: number
}): number {
  const { startMinutesFromMidnight, dayStartMinutes, slotMinutes, slotHeightPx } = params
  const minutesFromDayStart = Math.max(0, startMinutesFromMidnight - dayStartMinutes)
  return (minutesFromDayStart / slotMinutes) * slotHeightPx
}

/**
 * Block height (px) from total calendar minutes (on-site + travel). Teams-style scaling.
 */
export function getEventHeightPx(totalMinutes: number, slotMinutes: number, slotHeightPx: number): number {
  const d = Math.max(0, totalMinutes)
  return Math.max((d / slotMinutes) * slotHeightPx, 24)
}

export function defaultDayBodyHeightPx(slotCount: number, slotHeightPx: number): number {
  return slotCount * slotHeightPx
}
