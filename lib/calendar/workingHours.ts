import {
  CALENDAR_DAY_END_HOUR,
  CALENDAR_DAY_START_HOUR,
  CALENDAR_SLOT_MINUTES,
} from '@/lib/constants'

/** Minutes from midnight for the start of the calendar working window. */
export const WORK_START_MINUTES = CALENDAR_DAY_START_HOUR * 60
/** Minutes from midnight for the end of the working window (exclusive of work after this instant). */
export const WORK_END_MINUTES = CALENDAR_DAY_END_HOUR * 60

export function parseTimeToMinutes(input: string): number | null {
  const [a, b] = input.split(':').map(Number)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return a * 60 + b
}

export function minutesToTimeInput(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export type WorkingWindowResult = { ok: true } | { ok: false; message: string }

export function validateTimedEventWindow(startMinutes: number, durationMinutes: number): WorkingWindowResult {
  if (startMinutes < WORK_START_MINUTES) {
    return { ok: false, message: 'Start time must be at or after 7:00 AM.' }
  }
  if (startMinutes >= WORK_END_MINUTES) {
    return { ok: false, message: 'Start time must be before 6:00 PM.' }
  }
  if (durationMinutes <= 0) {
    return { ok: false, message: 'Duration must be greater than zero.' }
  }
  if (startMinutes + durationMinutes > WORK_END_MINUTES) {
    return { ok: false, message: 'Event must end by 6:00 PM.' }
  }
  return { ok: true }
}

/** Largest duration (minutes) that fits from startMinutes until WORK_END_MINUTES. */
export function maxDurationForStart(startMinutes: number): number {
  return Math.max(0, WORK_END_MINUTES - startMinutes)
}

/** Clamp duration to [0, maxDurationForStart(start)]. */
export function clampDurationToWorkingDay(startMinutes: number, durationMinutes: number): number {
  const cap = maxDurationForStart(startMinutes)
  return Math.min(Math.max(0, durationMinutes), cap)
}

/** Snap start into [WORK_START_MINUTES, WORK_END_MINUTES - 1] for picker bounds. */
export function clampStartMinutes(startMinutes: number): number {
  return Math.min(Math.max(startMinutes, WORK_START_MINUTES), WORK_END_MINUTES - 1)
}

export function formatSlotLabel(minutesFromMidnight: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setMinutes(minutesFromMidnight)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export const WORKING_DAY_SLOT_COUNT =
  (WORK_END_MINUTES - WORK_START_MINUTES) / CALENDAR_SLOT_MINUTES
