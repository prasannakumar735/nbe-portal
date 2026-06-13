import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureDraftWeeklySheet } from '@/lib/officeClock/ensureDraftWeek'
import { recalcWeeklyTimesheetTotals } from '@/lib/officeClock/recalcWeekTotals'
import { backfillFullWeekLeave } from '@/lib/timecard/backfillFullWeekLeave'
import { hasLoggedHours } from '@/lib/timecard/weekActivity'
import { weekEndFromStart } from '@/lib/timecard/weekDates'

export type SubmitWeeklyTimesheetMode = 'employee' | 'system'

export type SubmitWeeklyTimesheetResult =
  | { ok: true; sheet: Record<string, unknown> }
  | { ok: false; status: number; message: string }

type SheetRow = {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  total_hours: unknown
  status: string
}

export async function submitWeeklyTimesheet(
  supabase: SupabaseClient,
  params: {
    userId: string
    weekStart: string
    mode: SubmitWeeklyTimesheetMode
  },
): Promise<SubmitWeeklyTimesheetResult> {
  const weekEnd = weekEndFromStart(params.weekStart)
  let sheet: SheetRow | null = null

  const { data: existing, error: findErr } = await supabase
    .from('employee_weekly_timesheets')
    .select('id, user_id, week_start_date, week_end_date, total_hours, status')
    .eq('user_id', params.userId)
    .eq('week_start_date', params.weekStart)
    .maybeSingle()

  if (findErr) {
    return { ok: false, status: 500, message: findErr.message }
  }

  if (existing) {
    sheet = existing as SheetRow
  } else if (params.mode === 'employee') {
    try {
      const draft = await ensureDraftWeeklySheet(supabase, params.userId, params.weekStart)
      const { data: created, error: loadErr } = await supabase
        .from('employee_weekly_timesheets')
        .select('id, user_id, week_start_date, week_end_date, total_hours, status')
        .eq('id', draft.id)
        .single()
      if (loadErr || !created) {
        return { ok: false, status: 500, message: loadErr?.message ?? 'Could not load new timesheet.' }
      }
      sheet = created as SheetRow
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create timesheet.'
      return { ok: false, status: 409, message: msg }
    }
  } else {
    return { ok: false, status: 404, message: 'No timesheet for this week.' }
  }

  const status = String(sheet.status ?? '')
  if (status !== 'draft' && status !== 'rejected') {
    return { ok: false, status: 409, message: 'Timesheet is not editable.' }
  }

  if (params.mode === 'employee') {
    await recalcWeeklyTimesheetTotals(supabase, sheet.id)
    const { data: refreshed, error: refErr } = await supabase
      .from('employee_weekly_timesheets')
      .select('id, user_id, week_start_date, week_end_date, total_hours, status')
      .eq('id', sheet.id)
      .single()
    if (refErr || !refreshed) {
      return { ok: false, status: 500, message: refErr?.message ?? 'Recalc failed.' }
    }
    sheet = refreshed as SheetRow

    if (!hasLoggedHours(sheet.total_hours)) {
      try {
        await backfillFullWeekLeave(supabase, {
          timesheetId: sheet.id,
          userId: params.userId,
          weekStart: params.weekStart,
          weekEnd,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Leave backfill failed.'
        return { ok: false, status: 500, message: msg }
      }
      const { data: afterLeave, error: alErr } = await supabase
        .from('employee_weekly_timesheets')
        .select('id, user_id, week_start_date, week_end_date, total_hours, status')
        .eq('id', sheet.id)
        .single()
      if (alErr || !afterLeave) {
        return { ok: false, status: 500, message: alErr?.message ?? 'Could not reload timesheet.' }
      }
      sheet = afterLeave as SheetRow
    }
  } else {
    await recalcWeeklyTimesheetTotals(supabase, sheet.id)
    const { data: refreshed, error: refErr } = await supabase
      .from('employee_weekly_timesheets')
      .select('id, user_id, week_start_date, week_end_date, total_hours, status')
      .eq('id', sheet.id)
      .single()
    if (refErr || !refreshed) {
      return { ok: false, status: 500, message: refErr?.message ?? 'Recalc failed.' }
    }
    sheet = refreshed as SheetRow
    if (!hasLoggedHours(sheet.total_hours)) {
      return { ok: false, status: 409, message: 'Cannot auto-submit a week with no logged hours.' }
    }
  }

  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = {
    status: 'submitted',
    submitted_at: now,
    rejected_at: null,
    rejected_by: null,
    submitted_via: params.mode === 'system' ? 'system' : 'employee',
  }
  if (params.mode === 'system') {
    updatePayload.auto_submitted_at = now
  }

  const { data: updated, error: upErr } = await supabase
    .from('employee_weekly_timesheets')
    .update(updatePayload)
    .eq('id', sheet.id)
    .select('*')
    .single()

  if (upErr || !updated) {
    return { ok: false, status: 500, message: upErr?.message ?? 'Submit update failed.' }
  }

  return { ok: true, sheet: updated as Record<string, unknown> }
}
