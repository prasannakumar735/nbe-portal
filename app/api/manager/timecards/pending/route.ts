import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { PendingTimecardRow } from '@/lib/types/manager-timecards.types'
import type { EmployeeWeeklyTimesheet } from '@/lib/types/employee-timesheet.types'
import { fetchIsManagerOrAdmin } from '@/lib/auth/supabase-role'
import { profileDisplayName, type ProfileFromTable } from '@/lib/auth/roles'
import { loadLevel1CodeMap } from '@/lib/timecard/loadLevel1CodeMap'
import { isLeaveTimesheetEntry, splitWorkAndLeaveHours } from '@/lib/timecard/leaveWorkType'



function displayName(p: ProfileFromTable | null | undefined): string {
  const n = profileDisplayName(p ?? null)
  return n || 'Unknown'
}

/**
 * Submitted weekly timesheets pending manager review (excludes the caller’s own rows).
 */
export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await fetchIsManagerOrAdmin(supabase, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: sheets, error } = await supabase
      .from('employee_weekly_timesheets')
      .select('*')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })

    if (error) {
      throw error
    }

    const list = (sheets ?? []).filter(s => String(s.user_id) !== user.id)
    const sheetIds = list.map(s => String(s.id))
    const userIds = [...new Set(list.map(s => String(s.user_id)))]

    const profileById = new Map<string, ProfileFromTable & { id: string }>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .in('id', userIds)

      for (const p of profiles ?? []) {
        const row = p as ProfileFromTable & { id: string }
        profileById.set(row.id, row)
      }
    }

    const hoursBySheet = new Map<string, { workHours: number; leaveHours: number }>()
    if (sheetIds.length > 0) {
      const { data: entRows, error: entErr } = await supabase
        .from('employee_timesheet_entries')
        .select('timesheet_id, work_type_level1_id, total_hours')
        .in('timesheet_id', sheetIds)

      if (entErr) {
        throw entErr
      }

      const l1Ids = (entRows ?? []).map(r =>
        (r as { work_type_level1_id?: string | null }).work_type_level1_id
          ? String((r as { work_type_level1_id: string }).work_type_level1_id)
          : '',
      )
      const l1CodeById = await loadLevel1CodeMap(supabase, l1Ids)

      const bySheet = new Map<string, typeof entRows>()
      for (const r of entRows ?? []) {
        const sid = String((r as { timesheet_id?: string }).timesheet_id ?? '')
        if (!sid) continue
        const list = bySheet.get(sid) ?? []
        list.push(r)
        bySheet.set(sid, list)
      }

      for (const sid of sheetIds) {
        const rows = bySheet.get(sid) ?? []
        const split = splitWorkAndLeaveHours(
          rows,
          e => isLeaveTimesheetEntry(e as { work_type_level1_id?: string | null }, l1CodeById),
          e => Number((e as { total_hours?: number }).total_hours) || 0,
        )
        hoursBySheet.set(sid, { workHours: split.workHours, leaveHours: split.leaveHours })
      }
    }

    const rows: PendingTimecardRow[] = list.map(s => {
      const uid = String(s.user_id)
      const sid = String(s.id)
      const h = hoursBySheet.get(sid) ?? { workHours: 0, leaveHours: 0 }
      return {
        timesheet: s as EmployeeWeeklyTimesheet,
        employeeUserId: uid,
        employeeName: displayName(profileById.get(uid)),
        workHours: h.workHours,
        leaveHours: h.leaveHours,
      }
    })

    return NextResponse.json({ rows })
  } catch (e) {
    console.error('[GET /api/manager/timecards/pending]', e)
    return NextResponse.json({ error: 'Failed to load pending timecards' }, { status: 500 })
  }
}
