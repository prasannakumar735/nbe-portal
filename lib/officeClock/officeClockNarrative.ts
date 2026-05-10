import { OFFICE_CLOCK_TIMEZONE } from '@/lib/officeClock/melbourneWallClock'

/**
 * Office-clock timesheet `notes` use 24h Melbourne wall time (documented product format).
 * Example: Logged in at 04/05/2026, 08:02; logged out at 04/05/2026, 17:15; worked on task: Frame.
 */
export function formatMelbourneDateTime24hForNote(iso: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: OFFICE_CLOCK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(iso)
}

export function buildOfficeClockTimesheetNotes(clockInAt: Date, clockOutAt: Date, level2TaskName: string): string {
  const inStr = formatMelbourneDateTime24hForNote(clockInAt)
  const outStr = formatMelbourneDateTime24hForNote(clockOutAt)
  const task = (level2TaskName ?? '').trim() || 'Unknown task'
  return `Logged in at ${inStr}; logged out at ${outStr}; worked on task: ${task}.`
}
