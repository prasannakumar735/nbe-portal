import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { fetchIsManagerOrAdmin } from '@/lib/auth/supabase-role'

export const runtime = 'nodejs'

type Body = {
  weekStart?: string
  employeeUserId?: string
  action?: 'approve' | 'reject'
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body
    const weekStart = String(body.weekStart ?? '').trim()
    const employeeUserId = String(body.employeeUserId ?? '').trim()
    const action = body.action

    if (!weekStart || !employeeUserId) {
      return NextResponse.json({ error: 'weekStart and employeeUserId are required' }, { status: 400 })
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

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

    if (employeeUserId === user.id) {
      return NextResponse.json({ error: 'Use employee submit for your own week' }, { status: 400 })
    }

    const { data: sheet, error: findErr } = await supabase
      .from('employee_weekly_timesheets')
      .select('*')
      .eq('user_id', employeeUserId)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (findErr) {
      throw findErr
    }
    if (!sheet) {
      return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
    }
    if (sheet.status !== 'submitted') {
      return NextResponse.json({ error: 'Only submitted weeks can be reviewed' }, { status: 409 })
    }

    const now = new Date().toISOString()

    if (action === 'approve') {
      const { data: updated, error: upErr } = await supabase
        .from('employee_weekly_timesheets')
        .update({
          status: 'approved',
          approved_at: now,
          approved_by: user.id,
          rejected_at: null,
          rejected_by: null,
        })
        .eq('id', sheet.id)
        .select()
        .single()

      if (upErr) {
        throw upErr
      }
      return NextResponse.json({ timesheet: updated })
    }

    const { data: updated, error: upErr } = await supabase
      .from('employee_weekly_timesheets')
      .update({
        status: 'rejected',
        rejected_at: now,
        rejected_by: user.id,
        approved_at: null,
        approved_by: null,
      })
      .eq('id', sheet.id)
      .select()
      .single()

    if (upErr) {
      throw upErr
    }
    return NextResponse.json({ timesheet: updated })
  } catch (e) {
    console.error('[POST /api/timecard/review]', e)
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }
}
