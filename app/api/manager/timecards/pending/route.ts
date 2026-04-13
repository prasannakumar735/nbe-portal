import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { PendingTimecardRow } from '@/lib/types/manager-timecards.types'
import type { EmployeeWeeklyTimesheet } from '@/lib/types/employee-timesheet.types'
import { fetchIsManagerOrAdmin } from '@/lib/auth/supabase-role'
import { profileDisplayName, type ProfileFromTable } from '@/lib/auth/roles'

export const runtime = 'nodejs'

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

    const rows: PendingTimecardRow[] = list.map(s => {
      const uid = String(s.user_id)
      return {
        timesheet: s as EmployeeWeeklyTimesheet,
        employeeUserId: uid,
        employeeName: displayName(profileById.get(uid)),
      }
    })

    return NextResponse.json({ rows })
  } catch (e) {
    console.error('[GET /api/manager/timecards/pending]', e)
    return NextResponse.json({ error: 'Failed to load pending timecards' }, { status: 500 })
  }
}
