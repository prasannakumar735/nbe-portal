import type { SupabaseClient } from '@supabase/supabase-js'
import { addCalendarDays } from '@/lib/officeClock/attendanceRange'
import { formatMinutesAsTime } from '@/lib/timecard/computeHours'
import { resolveAnnualLeaveWorkTypes } from '@/lib/timecard/resolveLeaveWorkTypes'
import { recalcWeeklyTimesheetTotals } from '@/lib/officeClock/recalcWeekTotals'

function leaveHoursPerDay(): number {
  const raw = process.env.TIMECARD_LEAVE_HOURS_PER_DAY?.trim()
  const n = raw ? Number(raw) : 7.6
  return Number.isFinite(n) && n > 0 ? n : 7.6
}

function weekdayIndexMon1(isoDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!m) return 0
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const utc = new Date(Date.UTC(y, mo - 1, d))
  const dow = utc.getUTCDay()
  return dow === 0 ? 7 : dow
}

function leaveTimeRangeForHours(hours: number): { start: string; end: string; break_minutes: number } {
  const totalMinutes = Math.round(hours * 60)
  const start = 9 * 60
  const end = start + totalMinutes
  return {
    start: formatMinutesAsTime(start),
    end: formatMinutesAsTime(end),
    break_minutes: 0,
  }
}

/**
 * Inserts Mon–Fri ALV lines for dates in the week without existing entries.
 */
export async function backfillFullWeekLeave(
  supabase: SupabaseClient,
  params: {
    timesheetId: string
    userId: string
    weekStart: string
    weekEnd: string
  },
): Promise<number> {
  const leave = await resolveAnnualLeaveWorkTypes(supabase)
  const hoursPerDay = leaveHoursPerDay()
  const { start: startTime, end: endTime, break_minutes } = leaveTimeRangeForHours(hoursPerDay)

  const { data: existing, error: exErr } = await supabase
    .from('employee_timesheet_entries')
    .select('entry_date')
    .eq('timesheet_id', params.timesheetId)
  if (exErr) throw new Error(exErr.message)

  const occupied = new Set((existing ?? []).map(r => String(r.entry_date).slice(0, 10)))
  let inserted = 0
  let cursor = params.weekStart
  const weekEnd = params.weekEnd

  while (cursor <= weekEnd) {
    const wd = weekdayIndexMon1(cursor)
    if (wd >= 1 && wd <= 5 && !occupied.has(cursor)) {
      const { error: insErr } = await supabase.from('employee_timesheet_entries').insert({
        timesheet_id: params.timesheetId,
        user_id: params.userId,
        entry_date: cursor,
        client_id: null,
        location_id: null,
        work_type_level1_id: leave.work_type_level1_id,
        work_type_level2_id: leave.work_type_level2_id,
        task: leave.level2Name,
        start_time: startTime,
        end_time: endTime,
        break_minutes,
        total_hours: hoursPerDay,
        billable: false,
        notes: 'System: full-week leave on submit (no prior entries).',
        sort_order: inserted,
      })
      if (insErr) throw new Error(insErr.message)
      inserted += 1
    }
    cursor = addCalendarDays(cursor, 1)
  }

  await recalcWeeklyTimesheetTotals(supabase, params.timesheetId)
  return inserted
}
