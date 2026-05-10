import type { SupabaseClient } from '@supabase/supabase-js'
import { isTechnician, type ProfileFromTable } from '@/lib/auth/roles'
import { defaultBillableFromLevel1Code } from '@/lib/timecard/billableDefaults'
import { computeEntryTotalHours, timeStringToMinutes } from '@/lib/timecard/computeHours'
import { ensureDraftWeeklySheet, nextSortOrderForDay } from '@/lib/officeClock/ensureDraftWeek'
import { mondayWeekStartForCalendarDate } from '@/lib/officeClock/melbourneWallClock'
import { recalcWeeklyTimesheetTotals } from '@/lib/officeClock/recalcWeekTotals'
import { buildOfficeClockTimesheetNotes } from '@/lib/officeClock/officeClockNarrative'
import { resolveTechnicianFabLineForOfficeClock, type ResolvedFabLine } from '@/lib/officeClock/fabWorkTypes'

export type CompleteOfficeClockParams = {
  supabase: SupabaseClient
  userId: string
  profile: ProfileFromTable | null
  sessionId: string
  /** Resolved site row (env merge + dev autofill already applied). */
  siteRow: Record<string, unknown>
  clockInActual: Date
  /** Stored on office_attendance_sessions.clock_out_at */
  clockOutInstant: Date
  /** Melbourne calendar YYYY-MM-DD for the timesheet line */
  entryDate: string
  /** Melbourne wall times HH:mm for the line */
  startTimeMelbourne: string
  endTimeMelbourne: string
  breakMinutes: number
  workTypeLevel2IdFromBody?: string | null
}

function normalizeTimeForDb(t: string): string {
  const s = t.trim()
  return s.length === 5 ? `${s}:00` : s
}

async function resolveWorkTypesAndBillable(
  supabase: SupabaseClient,
  profile: ProfileFromTable | null,
  siteRow: Record<string, unknown>,
  workTypeLevel2IdFromBody: string | null | undefined,
): Promise<
  | { ok: true; l1: string; l2: string; billable: boolean; fabLine: ResolvedFabLine | null }
  | { ok: false; status: number; message: string }
> {
  if (isTechnician(profile)) {
    const techDefault =
      siteRow.technician_default_work_type_level2_id != null
        ? String(siteRow.technician_default_work_type_level2_id)
        : null
    const res = await resolveTechnicianFabLineForOfficeClock(supabase, workTypeLevel2IdFromBody, techDefault)
    if (!res.ok) return { ok: false, status: res.status, message: res.message }
    const billable = defaultBillableFromLevel1Code(res.line.level1Code)
    return {
      ok: true,
      l1: res.line.work_type_level1_id,
      l2: res.line.work_type_level2_id,
      billable,
      fabLine: res.line,
    }
  }

  const l1 = siteRow.work_type_level1_id != null ? String(siteRow.work_type_level1_id) : ''
  const l2 = siteRow.work_type_level2_id != null ? String(siteRow.work_type_level2_id) : ''
  if (!l1 || !l2) {
    return { ok: false, status: 503, message: 'Office site work types are not configured.' }
  }
  return {
    ok: true,
    l1,
    l2,
    billable: Boolean(siteRow.billable),
    fabLine: null,
  }
}

/**
 * Inserts employee_timesheet_entries, recalculates week totals, and closes the attendance session.
 * Idempotent session update: if another request already set timesheet_entry_id, rolls back the new line.
 */
export async function completeOfficeClockTimesheet(
  p: CompleteOfficeClockParams,
): Promise<
  | {
      ok: true
      timesheetEntryId: string
      entryDate: string
      startTime: string
      endTime: string
      totalHours: number
    }
  | { ok: false; status: number; message: string }
> {
  const startNorm = normalizeTimeForDb(p.startTimeMelbourne)
  const endNorm = normalizeTimeForDb(p.endTimeMelbourne)

  const wt = await resolveWorkTypesAndBillable(
    p.supabase,
    p.profile,
    p.siteRow,
    p.workTypeLevel2IdFromBody,
  )
  if (!wt.ok) return { ok: false, status: wt.status, message: wt.message }

  const { hours, error: calcErr } = computeEntryTotalHours(startNorm.slice(0, 8), endNorm.slice(0, 8), p.breakMinutes)
  if (calcErr) {
    return { ok: false, status: 400, message: calcErr }
  }

  const weekStartMonday = mondayWeekStartForCalendarDate(p.entryDate)
  let sheetId: string
  try {
    const sheet = await ensureDraftWeeklySheet(p.supabase, p.userId, weekStartMonday)
    sheetId = sheet.id
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'TIMESHEET_LOCKED' || err.message === 'TIMESHEET_LOCKED') {
      return {
        ok: false,
        status: 409,
        message:
          'Your timesheet week is submitted or approved. Unlock or reject the week before using office clock, or add hours manually.',
      }
    }
    throw e
  }

  const sortOrder = await nextSortOrderForDay(p.supabase, sheetId, p.entryDate)
  const entryId = crypto.randomUUID()

  let narrativeTaskName = wt.fabLine?.level2Name?.trim() ?? ''
  if (!narrativeTaskName && !wt.fabLine) {
    const { data: l2row } = await p.supabase.from('work_type_level2').select('name').eq('id', wt.l2).maybeSingle()
    narrativeTaskName = (l2row?.name != null ? String(l2row.name) : '').trim()
  }
  const taskLabel = wt.fabLine
    ? narrativeTaskName || 'Fabrication'
    : narrativeTaskName ||
        (p.siteRow.default_task != null ? String(p.siteRow.default_task).trim() : '') ||
        'Office'

  const notes = buildOfficeClockTimesheetNotes(p.clockInActual, p.clockOutInstant, narrativeTaskName || taskLabel)

  const { error: entErr } = await p.supabase.from('employee_timesheet_entries').insert({
    id: entryId,
    timesheet_id: sheetId,
    user_id: p.userId,
    entry_date: p.entryDate,
    client_id: String(p.siteRow.client_id),
    client_sub_project_id: null,
    location_id: String(p.siteRow.location_id),
    work_type_level1_id: wt.l1,
    work_type_level2_id: wt.l2,
    task: taskLabel,
    start_time: startNorm,
    end_time: endNorm,
    break_minutes: p.breakMinutes,
    total_hours: hours,
    billable: wt.billable,
    notes,
    gps_start: null,
    gps_end: null,
    gps_start_address: null,
    gps_start_meta: null,
    gps_end_address: null,
    gps_end_meta: null,
    sort_order: sortOrder,
  })

  if (entErr) {
    console.error('[completeOfficeClockTimesheet] insert entry', entErr)
    return { ok: false, status: 500, message: 'Could not add timesheet line. Check week is editable.' }
  }

  await recalcWeeklyTimesheetTotals(p.supabase, sheetId)

  const { data: updatedRows, error: upSessErr } = await p.supabase
    .from('office_attendance_sessions')
    .update({
      clock_out_at: p.clockOutInstant.toISOString(),
      timesheet_entry_id: entryId,
    })
    .eq('id', p.sessionId)
    .eq('user_id', p.userId)
    .is('timesheet_entry_id', null)
    .select('id')

  if (upSessErr) {
    console.error('[completeOfficeClockTimesheet] update session', upSessErr)
    await p.supabase.from('employee_timesheet_entries').delete().eq('id', entryId)
    await recalcWeeklyTimesheetTotals(p.supabase, sheetId)
    return { ok: false, status: 500, message: 'Could not finalize attendance. Try again.' }
  }

  if (!updatedRows?.length) {
    await p.supabase.from('employee_timesheet_entries').delete().eq('id', entryId)
    await recalcWeeklyTimesheetTotals(p.supabase, sheetId)
    return {
      ok: false,
      status: 409,
      message: 'This session was already closed. Refresh if you expected a new line.',
    }
  }

  return {
    ok: true,
    timesheetEntryId: entryId,
    entryDate: p.entryDate,
    startTime: startNorm.slice(0, 5),
    endTime: endNorm.slice(0, 5),
    totalHours: hours,
  }
}

/** Caps default break to worked span; synthetic office-day uses an explicit break (e.g. 30) with a 9h gross span. */
export function officeClockBreakMinutes(rawBreak: number, startTimeHHmm: string, endTimeHHmm: string): number {
  const startM = timeStringToMinutes(startTimeHHmm)
  const endM = timeStringToMinutes(endTimeHHmm)
  if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) {
    return Math.max(0, Math.min(rawBreak, 0))
  }
  const grossMin = endM - startM
  return Math.min(Math.max(0, rawBreak), grossMin)
}
