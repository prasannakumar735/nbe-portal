import type { SupabaseClient } from '@supabase/supabase-js'
import { weekEndFromStart } from '@/lib/timecard/weekDates'

export async function ensureDraftWeeklySheet(
  supabase: SupabaseClient,
  userId: string,
  weekStartMonday: string,
): Promise<{ id: string; status: string }> {
  const weekEnd = weekEndFromStart(weekStartMonday)
  const { data: existing, error: selErr } = await supabase
    .from('employee_weekly_timesheets')
    .select('id, status')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartMonday)
    .maybeSingle()
  if (selErr) throw new Error(selErr.message)
  if (existing?.id) {
    const st = String(existing.status ?? '')
    if (st !== 'draft' && st !== 'rejected') {
      const e = new Error('TIMESHEET_LOCKED')
      ;(e as Error & { code?: string }).code = 'TIMESHEET_LOCKED'
      throw e
    }
    return { id: String(existing.id), status: st }
  }
  const { data: created, error: insErr } = await supabase
    .from('employee_weekly_timesheets')
    .insert({
      user_id: userId,
      week_start_date: weekStartMonday,
      week_end_date: weekEnd,
      total_hours: 0,
      billable_hours: 0,
      status: 'draft',
    })
    .select('id, status')
    .single()
  if (insErr || !created) {
    throw new Error(insErr?.message ?? 'WEEK_CREATE_FAILED')
  }
  return { id: String(created.id), status: String(created.status ?? 'draft') }
}

export async function nextSortOrderForDay(
  supabase: SupabaseClient,
  timesheetId: string,
  entryDate: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('employee_timesheet_entries')
    .select('sort_order')
    .eq('timesheet_id', timesheetId)
    .eq('entry_date', entryDate)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (error) return 0
  const max = data?.[0]?.sort_order
  return typeof max === 'number' ? max + 1 : 0
}
