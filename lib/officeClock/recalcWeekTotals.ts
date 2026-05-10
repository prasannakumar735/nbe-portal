import type { SupabaseClient } from '@supabase/supabase-js'

export async function recalcWeeklyTimesheetTotals(
  supabase: SupabaseClient,
  timesheetId: string,
): Promise<void> {
  const { data: allEntries, error } = await supabase
    .from('employee_timesheet_entries')
    .select('total_hours, billable')
    .eq('timesheet_id', timesheetId)
  if (error) {
    console.warn('[recalcWeeklyTimesheetTotals]', error.message)
    return
  }
  let total = 0
  let billable = 0
  for (const r of allEntries ?? []) {
    const row = r as { total_hours?: number; billable?: boolean }
    const h = Number(row.total_hours ?? 0) || 0
    total += h
    if (row.billable) billable += h
  }
  await supabase
    .from('employee_weekly_timesheets')
    .update({
      total_hours: Math.round(total * 10000) / 10000,
      billable_hours: Math.round(billable * 10000) / 10000,
    })
    .eq('id', timesheetId)
}
