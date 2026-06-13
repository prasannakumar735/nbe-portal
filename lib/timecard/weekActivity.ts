import type { SupabaseClient } from '@supabase/supabase-js'
import { attendanceClockInUtcBounds } from '@/lib/officeClock/attendanceRange'

export function hasLoggedHours(totalHours: unknown): boolean {
  const h = Number(totalHours ?? 0)
  return Number.isFinite(h) && h > 0
}

export async function hasOfficeClockActivity(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<boolean> {
  const { startIso, endExclusiveIso } = attendanceClockInUtcBounds(weekStart, weekEnd)
  const { count, error } = await supabase
    .from('office_attendance_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('clock_in_at', startIso)
    .lt('clock_in_at', endExclusiveIso)
  if (error) {
    console.warn('[hasOfficeClockActivity]', error.message)
    return false
  }
  return (count ?? 0) > 0
}

export async function countTimesheetEntries(
  supabase: SupabaseClient,
  timesheetId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('employee_timesheet_entries')
    .select('id', { count: 'exact', head: true })
    .eq('timesheet_id', timesheetId)
  if (error) return 0
  return count ?? 0
}

/**
 * Inactive for automation: no sheet row, no office clock, and no entry lines.
 * If a row exists with zero hours and zero lines, also inactive.
 */
export async function isInactiveWeekForAutomation(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
  weekEnd: string,
  sheet: { id: string; total_hours?: unknown } | null,
): Promise<boolean> {
  const clock = await hasOfficeClockActivity(supabase, userId, weekStart, weekEnd)
  if (clock) return false
  if (!sheet) return true
  if (hasLoggedHours(sheet.total_hours)) return false
  const entryCount = await countTimesheetEntries(supabase, sheet.id)
  return entryCount === 0
}
